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
  let adminUserId: string;
  let itemInB: { id: string; itemText: string };
  let itemInA: { id: string; itemText: string };

  beforeAll(async () => {
    projectA = await prisma.project.create({ data: { name: "[TEST] Isolation Project A", contractValue: 10000, plannedManDays: 20 } });
    projectB = await prisma.project.create({ data: { name: "[TEST] Isolation Project B", contractValue: 20000, plannedManDays: 40 } });

    const passwordHash = await bcrypt.hash("test-password-not-used", 10);
    const pmA = await prisma.user.create({ data: { email: `test-pm-a-${Date.now()}@example.test`, name: "Test PM A", passwordHash, role: "PM" } });
    const clientB = await prisma.user.create({ data: { email: `test-client-b-${Date.now()}@example.test`, name: "Test Client B", passwordHash, role: "CLIENT" } });
    const admin = await prisma.user.create({ data: { email: `test-admin-${Date.now()}@example.test`, name: "Test Admin", passwordHash, role: "ADMIN" } });
    pmAUserId = pmA.id;
    clientBUserId = clientB.id;
    adminUserId = admin.id;

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
    // Cascades take care of memberships/permissions/checklist items. Audit
    // log rows for project-scoped actions cascade with the project, but the
    // Checklist Template actions write project-less audit rows (correctly —
    // the template isn't project data), so those need explicit cleanup
    // before the users can be deleted (AuditLog.actorId has no cascade,
    // by design — an audit trail shouldn't silently lose its actor).
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [pmAUserId, clientBUserId, adminUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId, adminUserId] } } });
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

  it("Client-B sees Milestones in full but Risk Register/CR Log/Budget/Decision Log/Action Items are NONE, on their own assigned project", async () => {
    const { getModuleAccess } = await import("@/lib/rbac");
    actAs(clientBUserId);
    expect(await getModuleAccess(projectB.id, "MILESTONES")).toBe("READ_FULL");
    expect(await getModuleAccess(projectB.id, "RISK_REGISTER")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "CR_LOG")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "BUDGET_TRACKER")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "DECISION_LOG")).toBe("NONE");
    expect(await getModuleAccess(projectB.id, "ACTION_ITEMS")).toBe("NONE");
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

  it("Admin-only rename: PM-A cannot rename a fixed template item's text, even on their own project", async () => {
    const { updateChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);
    await expect(updateChecklistItem(itemInA.id, projectA.id, "PM", { itemText: "hacked" })).rejects.toThrow();
    const stillUnchanged = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemInA.id } });
    expect(stillUnchanged.itemText).toBe(itemInA.itemText);
  });

  it("sanity check: Admin CAN rename a fixed template item's text", async () => {
    const { updateChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(adminUserId);
    await updateChecklistItem(itemInA.id, projectA.id, "PM", { itemText: "[TEST] renamed by admin" });
    const updated = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemInA.id } });
    expect(updated.itemText).toBe("[TEST] renamed by admin");
  });

  it("PM-A cannot delete a fixed template item — only custom items are deletable", async () => {
    const { deleteChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);
    await expect(deleteChecklistItem(itemInA.id, projectA.id, "PM")).rejects.toThrow();
    expect(await prisma.checklistItem.findUnique({ where: { id: itemInA.id } })).not.toBeNull();
  });

  it("sanity check: PM-A CAN rename and delete their own custom item", async () => {
    const { updateChecklistItem, deleteChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);
    const custom = await prisma.checklistItem.create({
      data: { projectId: projectA.id, type: "PM", order: 997, stage: "Pre-Sales & Initiation", itemText: "[TEST] before rename", isCustom: true },
    });

    await updateChecklistItem(custom.id, projectA.id, "PM", { itemText: "[TEST] after rename" });
    expect((await prisma.checklistItem.findUniqueOrThrow({ where: { id: custom.id } })).itemText).toBe("[TEST] after rename");

    await deleteChecklistItem(custom.id, projectA.id, "PM");
    expect(await prisma.checklistItem.findUnique({ where: { id: custom.id } })).toBeNull();
  });

  it("guessed-ID attack: PM-A cannot add a checklist item to Project B", async () => {
    const { createChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    actAs(pmAUserId);
    await expect(createChecklistItem(projectB.id, "PM", "Pre-Sales & Initiation")).rejects.toThrow();
  });

  it("guessed-ID attack: PM-A cannot delete a real (custom) ChecklistItem that belongs to Project B", async () => {
    const { deleteChecklistItem } = await import("@/app/projects/[projectId]/checklist-actions");
    const customInB = await prisma.checklistItem.create({
      data: { projectId: projectB.id, type: "PM", order: 996, stage: "Pre-Sales & Initiation", itemText: "[TEST] custom in B", isCustom: true },
    });
    actAs(pmAUserId);
    await expect(deleteChecklistItem(customInB.id, projectB.id, "PM")).rejects.toThrow();
    expect(await prisma.checklistItem.findUnique({ where: { id: customInB.id } })).not.toBeNull();
  });

  it("getReminderItems only returns overdue/due-soon items from the caller's own projects", async () => {
    const { getReminderItems } = await import("@/lib/notifications");
    const overdue = new Date(Date.now() - 5 * 86400000);

    const overdueInA = await prisma.checklistItem.create({
      data: { projectId: projectA.id, type: "PM", order: 995, stage: "Pre-Sales & Initiation", itemText: "[TEST] overdue in A", status: "IN_PROGRESS", plannedDate: overdue },
    });
    const overdueInB = await prisma.checklistItem.create({
      data: { projectId: projectB.id, type: "PM", order: 991, stage: "Pre-Sales & Initiation", itemText: "[TEST] overdue in B", status: "IN_PROGRESS", plannedDate: overdue },
    });

    const items = await getReminderItems({ id: pmAUserId, email: "x@example.test", name: "Test PM A", role: "PM" });
    expect(items.some((i) => i.itemText === overdueInA.itemText)).toBe(true);
    expect(items.some((i) => i.itemText === overdueInB.itemText)).toBe(false);
  });

  it("getReminderItems returns nothing for CLIENT, LIMITED, or PROGRAM_MANAGER, regardless of membership", async () => {
    const { getReminderItems } = await import("@/lib/notifications");
    const overdue = new Date(Date.now() - 5 * 86400000);

    await prisma.checklistItem.create({
      data: { projectId: projectB.id, type: "PM", order: 990, stage: "Pre-Sales & Initiation", itemText: "[TEST] overdue in B for client", status: "IN_PROGRESS", plannedDate: overdue },
    });

    const client = await getReminderItems({ id: clientBUserId, email: "x@example.test", name: "Test Client B", role: "CLIENT" });
    expect(client).toEqual([]);

    const limited = await getReminderItems({ id: clientBUserId, email: "x@example.test", name: "Test Client B", role: "LIMITED" });
    expect(limited).toEqual([]);

    const programManager = await getReminderItems({ id: adminUserId, email: "x@example.test", name: "Test Admin", role: "PROGRAM_MANAGER" });
    expect(programManager).toEqual([]);
  });

  it("sanity check: PM-A CAN add a milestone (creates ChecklistItem + MilestonePayment together) and rename it", async () => {
    const { addMilestone, updateMilestoneName } = await import("@/app/projects/[projectId]/milestones/milestone-actions");
    actAs(pmAUserId);

    await addMilestone(projectA.id, { checklistType: "PM", stage: "Planning", name: "[TEST] Beta Signoff" });

    const created = await prisma.checklistItem.findFirstOrThrow({
      where: { projectId: projectA.id, milestoneName: "[TEST] Beta Signoff" },
      include: { milestonePayment: true },
    });
    expect(created.isCustom).toBe(true);
    expect(created.stage).toBe("Planning");
    expect(created.milestonePayment?.paymentPct).toBe(0);

    await updateMilestoneName(created.id, projectA.id, "[TEST] Beta Signoff (renamed)");
    const renamed = await prisma.checklistItem.findUniqueOrThrow({ where: { id: created.id } });
    expect(renamed.milestoneName).toBe("[TEST] Beta Signoff (renamed)");
  });

  it("guessed-ID attack: PM-A cannot add a milestone to Project B, or rename one that belongs to it", async () => {
    const { addMilestone, updateMilestoneName } = await import("@/app/projects/[projectId]/milestones/milestone-actions");

    const milestoneItemInB = await prisma.checklistItem.create({
      data: { projectId: projectB.id, type: "PM", order: 995, stage: "Pre-Sales & Initiation", itemText: "[TEST] B milestone", milestoneName: "[TEST] B milestone" },
    });
    await prisma.milestonePayment.create({ data: { checklistItemId: milestoneItemInB.id, paymentPct: 0.1 } });

    actAs(pmAUserId);
    await expect(addMilestone(projectB.id, { checklistType: "PM", stage: "Planning", name: "[TEST] should fail" })).rejects.toThrow();
    await expect(updateMilestoneName(milestoneItemInB.id, projectB.id, "hacked")).rejects.toThrow();

    const stillUnchanged = await prisma.checklistItem.findUniqueOrThrow({ where: { id: milestoneItemInB.id } });
    expect(stillUnchanged.milestoneName).toBe("[TEST] B milestone");
  });

  it("Checklist Template is Admin-only: a PM (even with WRITE everywhere on their own project) cannot touch it", async () => {
    const { createTemplateItem, updateTemplateItem, deleteTemplateItem } = await import("@/app/admin/checklist-template/template-actions");
    actAs(pmAUserId);

    await expect(createTemplateItem("PM", "[TEST] Stage")).rejects.toThrow();

    const templateItem = await prisma.checklistTemplateItem.create({
      data: { type: "PM", order: -100, stage: "[TEST] Stage", itemText: "[TEST] template item" },
    });
    try {
      await expect(updateTemplateItem(templateItem.id, { itemText: "hacked" })).rejects.toThrow();
      await expect(deleteTemplateItem(templateItem.id)).rejects.toThrow();
      const stillThere = await prisma.checklistTemplateItem.findUniqueOrThrow({ where: { id: templateItem.id } });
      expect(stillThere.itemText).toBe("[TEST] template item");
    } finally {
      await prisma.checklistTemplateItem.delete({ where: { id: templateItem.id } });
    }
  });

  it("changePassword rejects a wrong current password without touching the hash", async () => {
    const { changePassword } = await import("@/app/admin/users/user-actions");
    actAs(pmAUserId);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: pmAUserId } });
    await expect(changePassword("definitely-wrong-password", "a-new-password-123")).rejects.toThrow();
    const after = await prisma.user.findUniqueOrThrow({ where: { id: pmAUserId } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("changePassword CAN change your own password given the correct current one", async () => {
    const { changePassword } = await import("@/app/admin/users/user-actions");
    actAs(pmAUserId);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: pmAUserId } });
    await changePassword("test-password-not-used", "a-brand-new-password-123");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: pmAUserId } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await bcrypt.compare("a-brand-new-password-123", after.passwordHash)).toBe(true);
  });

  it("resetUserPassword is Admin-only: a PM cannot reset another user's password", async () => {
    const { resetUserPassword } = await import("@/app/admin/users/user-actions");
    actAs(pmAUserId);
    await expect(resetUserPassword(clientBUserId)).rejects.toThrow();
  });

  it("sanity check: Admin CAN reset a user's password", async () => {
    const { resetUserPassword } = await import("@/app/admin/users/user-actions");
    actAs(adminUserId);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: clientBUserId } });
    const { tempPassword } = await resetUserPassword(clientBUserId);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: clientBUserId } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await bcrypt.compare(tempPassword, after.passwordHash)).toBe(true);
  });

  it("deactivating a user cuts their access immediately — getCurrentUser() returns null, not stale data", async () => {
    const { getCurrentUser } = await import("@/lib/rbac");
    const { setUserActive } = await import("@/app/admin/users/user-actions");

    actAs(clientBUserId);
    expect(await getCurrentUser()).not.toBeNull();

    actAs(adminUserId);
    await setUserActive(clientBUserId, false);

    actAs(clientBUserId);
    expect(await getCurrentUser()).toBeNull();

    // Restore so later tests in this file that depend on clientB still work.
    actAs(adminUserId);
    await setUserActive(clientBUserId, true);
    actAs(clientBUserId);
    expect(await getCurrentUser()).not.toBeNull();
  });

  it("setUserActive/updateUserProfile are Admin-only, and an Admin can't deactivate themselves", async () => {
    const { setUserActive, updateUserProfile } = await import("@/app/admin/users/user-actions");

    actAs(pmAUserId);
    await expect(setUserActive(clientBUserId, false)).rejects.toThrow();
    await expect(updateUserProfile(clientBUserId, { name: "hacked" })).rejects.toThrow();

    actAs(adminUserId);
    await expect(setUserActive(adminUserId, false)).rejects.toThrow();
  });

  it("updateUserProfile rejects an email collision but allows a real rename", async () => {
    const { updateUserProfile } = await import("@/app/admin/users/user-actions");
    actAs(adminUserId);

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminUserId } });
    await expect(updateUserProfile(clientBUserId, { email: admin.email })).rejects.toThrow();

    await updateUserProfile(clientBUserId, { name: "[TEST] Renamed Client B" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: clientBUserId } });
    expect(updated.name).toBe("[TEST] Renamed Client B");
  });

  it("setProjectStatus (archive) is Admin-only", async () => {
    const { setProjectStatus } = await import("@/app/projects/actions");
    actAs(pmAUserId);
    await expect(setProjectStatus(projectA.id, "ARCHIVED")).rejects.toThrow();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).status).toBe("ACTIVE");
  });

  it("sanity check: Admin CAN archive and unarchive a project", async () => {
    const { setProjectStatus } = await import("@/app/projects/actions");
    actAs(adminUserId);

    await setProjectStatus(projectA.id, "ARCHIVED");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).status).toBe("ARCHIVED");

    await setProjectStatus(projectA.id, "ACTIVE");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).status).toBe("ACTIVE");
  });

  it("deleteProject / restoreProject are Admin-only", async () => {
    const { deleteProject, restoreProject } = await import("@/app/projects/actions");
    actAs(pmAUserId);
    await expect(deleteProject(projectA.id)).rejects.toThrow();
    await expect(restoreProject(projectA.id)).rejects.toThrow();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).deletedAt).toBeNull();
  });

  it("sanity check: Admin CAN delete and restore a project", async () => {
    const { deleteProject, restoreProject } = await import("@/app/projects/actions");
    actAs(adminUserId);

    await deleteProject(projectA.id);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).deletedAt).not.toBeNull();

    await restoreProject(projectA.id);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } })).deletedAt).toBeNull();
  });

  it("permanentlyDeleteProject is Admin-only", async () => {
    const { permanentlyDeleteProject } = await import("@/app/projects/actions");
    actAs(pmAUserId);
    await expect(permanentlyDeleteProject(projectA.id)).rejects.toThrow();
    expect(await prisma.project.findUnique({ where: { id: projectA.id } })).not.toBeNull();
  });

  it("permanentlyDeleteProject rejects a project that hasn't been soft-deleted first", async () => {
    const { permanentlyDeleteProject } = await import("@/app/projects/actions");
    const throwaway = await prisma.project.create({ data: { name: "[TEST] Not yet soft-deleted", contractValue: 0, plannedManDays: 0 } });
    actAs(adminUserId);
    try {
      await expect(permanentlyDeleteProject(throwaway.id)).rejects.toThrow();
      expect(await prisma.project.findUnique({ where: { id: throwaway.id } })).not.toBeNull();
    } finally {
      await prisma.project.delete({ where: { id: throwaway.id } });
    }
  });

  it("sanity check: Admin CAN permanently delete a project that's already in the trash", async () => {
    const { deleteProject, permanentlyDeleteProject } = await import("@/app/projects/actions");
    const throwaway = await prisma.project.create({ data: { name: "[TEST] Permanent delete target", contractValue: 0, plannedManDays: 0 } });
    actAs(adminUserId);

    await deleteProject(throwaway.id);
    await permanentlyDeleteProject(throwaway.id);
    expect(await prisma.project.findUnique({ where: { id: throwaway.id } })).toBeNull();
  });

  it("sanity check: Admin CAN manage the checklist template", async () => {
    const { createTemplateItem, updateTemplateItem, deleteTemplateItem } = await import("@/app/admin/checklist-template/template-actions");
    actAs(adminUserId);

    await createTemplateItem("PM", "[TEST] Stage");
    const created = await prisma.checklistTemplateItem.findFirstOrThrow({ where: { type: "PM", stage: "[TEST] Stage" } });

    await updateTemplateItem(created.id, { itemText: "[TEST] renamed" });
    expect((await prisma.checklistTemplateItem.findUniqueOrThrow({ where: { id: created.id } })).itemText).toBe("[TEST] renamed");

    await deleteTemplateItem(created.id);
    expect(await prisma.checklistTemplateItem.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("guessed-ID attack: PM-A cannot create, update, or delete a Decision Log entry on Project B", async () => {
    const { createDecision, updateDecision, deleteDecision } = await import("@/app/projects/[projectId]/decisions/decision-actions");
    const decisionInB = await prisma.decisionLogItem.create({ data: { projectId: projectB.id, decision: "[TEST] decision in B" } });

    actAs(pmAUserId);
    await expect(createDecision(projectB.id)).rejects.toThrow();
    await expect(updateDecision(decisionInB.id, projectB.id, { decision: "hacked" })).rejects.toThrow();
    await expect(deleteDecision(decisionInB.id, projectB.id)).rejects.toThrow();

    const stillThere = await prisma.decisionLogItem.findUniqueOrThrow({ where: { id: decisionInB.id } });
    expect(stillThere.decision).toBe("[TEST] decision in B");
  });

  it("sanity check: PM-A CAN create, update, and delete a Decision Log entry on their own project", async () => {
    const { createDecision, updateDecision, deleteDecision } = await import("@/app/projects/[projectId]/decisions/decision-actions");
    actAs(pmAUserId);

    await createDecision(projectA.id);
    const created = await prisma.decisionLogItem.findFirstOrThrow({ where: { projectId: projectA.id, decision: "New decision" } });

    await updateDecision(created.id, projectA.id, { decision: "[TEST] renamed decision", rationale: "[TEST] because reasons" });
    const updated = await prisma.decisionLogItem.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.decision).toBe("[TEST] renamed decision");
    expect(updated.rationale).toBe("[TEST] because reasons");

    await deleteDecision(created.id, projectA.id);
    expect(await prisma.decisionLogItem.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("guessed-ID attack: PM-A cannot create, update, or delete an Action Item on Project B", async () => {
    const { createActionItem, updateActionItem, deleteActionItem } = await import("@/app/projects/[projectId]/action-items/action-item-actions");
    const actionInB = await prisma.actionItem.create({ data: { projectId: projectB.id, description: "[TEST] action in B" } });

    actAs(pmAUserId);
    await expect(createActionItem(projectB.id)).rejects.toThrow();
    await expect(updateActionItem(actionInB.id, projectB.id, { status: "Done" })).rejects.toThrow();
    await expect(deleteActionItem(actionInB.id, projectB.id)).rejects.toThrow();

    const stillThere = await prisma.actionItem.findUniqueOrThrow({ where: { id: actionInB.id } });
    expect(stillThere.status).toBe("Open");
  });

  it("sanity check: PM-A CAN create, toggle, and delete an Action Item on their own project", async () => {
    const { createActionItem, updateActionItem, deleteActionItem } = await import("@/app/projects/[projectId]/action-items/action-item-actions");
    actAs(pmAUserId);

    await createActionItem(projectA.id);
    const created = await prisma.actionItem.findFirstOrThrow({ where: { projectId: projectA.id, description: "New action item" } });
    expect(created.status).toBe("Open");

    await updateActionItem(created.id, projectA.id, { status: "Done" });
    expect((await prisma.actionItem.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("Done");

    await deleteActionItem(created.id, projectA.id);
    expect(await prisma.actionItem.findUnique({ where: { id: created.id } })).toBeNull();
  });
});
