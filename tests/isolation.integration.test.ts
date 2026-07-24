// Hits the real (dev/Supabase) database configured via .env — seeds two
// throwaway projects and two users, exercises the ACTUAL production
// authorization code (lib/rbac.ts) and an ACTUAL server action
// (updateChecklistItem), and cleans up its fixtures afterward regardless of
// pass/fail. This is the isolation-boundary test: a PM or Client scoped to
// Project A must never be able to read or write Project B's data, even when
// handed a real, valid entity id that happens to belong to Project B.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CLIENT_PERMISSIONS } from "@/lib/rbac-core";

// lib/rbac.ts is marked "server-only" (throws when imported outside Next's
// server-component bundler); neutralize that marker for this plain-Node test.
vi.mock("server-only", () => ({}));
// requireProjectAccess/requireModuleAccess call these on failure; give them
// Node-safe implementations so a rejection surfaces as a normal thrown Error.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
// revalidatePath needs an active Next.js request context; no-op it here.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let currentSessionUserId: string | null = null;
vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
}));

function actAs(userId: string | null) {
  currentSessionUserId = userId;
}

describe("isolation boundary", () => {
  let projectA: { id: string };
  let projectB: { id: string };
  let pmAUserId: string;
  let clientBUserId: string;
  let itemInB: { id: string; itemText: string };
  let itemInA: { id: string };

  beforeAll(async () => {
    projectA = await prisma.project.create({ data: { name: "[TEST] Isolation Project A", contractValue: 10000, plannedManDays: 20 } });
    projectB = await prisma.project.create({ data: { name: "[TEST] Isolation Project B", contractValue: 20000, plannedManDays: 40 } });

    const passwordHash = await bcrypt.hash("test-password-not-used", 10);
    const pmA = await prisma.user.create({ data: { email: `test-pm-a-${Date.now()}@example.test`, name: "Test PM A", passwordHash, role: "PM" } });
    const clientB = await prisma.user.create({ data: { email: `test-client-b-${Date.now()}@example.test`, name: "Test Client B", passwordHash, role: "CLIENT" } });
    pmAUserId = pmA.id;
    clientBUserId = clientB.id;

    await prisma.projectMembership.create({ data: { userId: pmAUserId, projectId: projectA.id, role: "PM" } });
    const clientMembership = await prisma.projectMembership.create({ data: { userId: clientBUserId, projectId: projectB.id, role: "CLIENT" } });
    await prisma.modulePermission.createMany({
      data: DEFAULT_CLIENT_PERMISSIONS.map((p) => ({ membershipId: clientMembership.id, module: p.module, access: p.access })),
    });

    itemInA = await prisma.checklistItem.create({
      data: { projectId: projectA.id, type: "PM", order: 1, stage: "Pre-Sales & Initiation", itemText: "[TEST] item in A" },
    });
    itemInB = await prisma.checklistItem.create({
      data: { projectId: projectB.id, type: "PM", order: 1, stage: "Pre-Sales & Initiation", itemText: "[TEST] item in B" },
    });
  });

  afterAll(async () => {
    // Cascades take care of memberships/permissions/checklist items.
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId] } } });
  });

  it("PM-A has WRITE on their own project's modules, NONE on the other project's", async () => {
    const { getModuleAccess } = await import("@/lib/rbac");
    actAs(pmAUserId);
    expect(await getModuleAccess(projectA.id, "PM_CHECKLIST")).toBe("WRITE");
    expect(await getModuleAccess(projectB.id, "PM_CHECKLIST")).toBe("NONE");
  });

  it("PM-A is 404'd (not just blocked) when entering Project B's route tree", async () => {
    const { requireProjectAccess } = await import("@/lib/rbac");
    actAs(pmAUserId);
    await expect(requireProjectAccess(projectB.id)).rejects.toThrow("NOT_FOUND");
  });

  it("guessed-ID attack: PM-A cannot update a real ChecklistItem that belongs to Project B", async () => {
    const { updateChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);

    // Even though itemInB.id is a genuine, valid row, and even if the caller
    // lies and passes projectB.id as the projectId argument, the action must
    // look up the item's REAL project server-side and reject.
    await expect(updateChecklistItem(itemInB.id, projectB.id, "PM", { status: "COMPLETED" })).rejects.toThrow();

    const stillUnchanged = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemInB.id } });
    expect(stillUnchanged.status).toBe("NOT_STARTED");
  });

  it("sanity check: PM-A CAN update their own project's item through the same action", async () => {
    const { updateChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);

    await updateChecklistItem(itemInA.id, projectA.id, "PM", { status: "COMPLETED" });

    const updated = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemInA.id } });
    expect(updated.status).toBe("COMPLETED");
  });

  it("Client-B sees Milestones in full but Risk Register/CR Log/Budget are NONE, on their own assigned project", async () => {
    const { getModuleAccess } = await import("@/lib/rbac");
    actAs(clientBUserId);
    expect(await getModuleAccess(projectB.id, "MILESTONES")).toBe("READ_FULL");
    expect(await getModuleAccess(projectB.id, "RISK_REGISTER")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "CR_LOG")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "BUDGET_TRACKER")).toBe("NONE");
  });

  it("Client-B has NONE on every module of Project A — a role held elsewhere grants nothing here", async () => {
    const { getModuleAccess } = await import("@/lib/rbac");
    actAs(clientBUserId);
    for (const module of ["DASHBOARD", "PM_CHECKLIST", "MILESTONES"] as const) {
      expect(await getModuleAccess(projectA.id, module)).toBe("NONE");
    }
  });

  it("Client-B is 404'd entering Project A's route tree", async () => {
    const { requireProjectAccess } = await import("@/lib/rbac");
    actAs(clientBUserId);
    await expect(requireProjectAccess(projectA.id)).rejects.toThrow("NOT_FOUND");
  });

  it("an unauthenticated caller gets NONE, never a default-allow", async () => {
    const { getModuleAccess } = await import("@/lib/rbac");
    actAs(null);
    expect(await getModuleAccess(projectA.id, "PM_CHECKLIST")).toBe("NONE");
  });
});
