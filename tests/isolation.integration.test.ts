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

  // Presales isn't project-scoped (no membership row, role-level access
  // only), so its fixtures are independent of projectA/projectB and each
  // test cleans up its own rows rather than relying on the outer afterAll.
  it("presales: CLIENT cannot create, update, or delete an opportunity", async () => {
    const { createPresalesProject, updatePresalesProject, deletePresalesProject } = await import("@/app/presales/actions");
    const opp = await prisma.presalesProject.create({ data: { name: "[TEST] presales client-blocked", createdById: pmAUserId } });

    actAs(clientBUserId);
    const fd = new FormData();
    fd.set("name", "[TEST] should not be created");
    await expect(createPresalesProject(fd)).rejects.toThrow();
    await expect(updatePresalesProject(opp.id, { name: "hacked" })).rejects.toThrow();
    await expect(deletePresalesProject(opp.id)).rejects.toThrow();

    const stillThere = await prisma.presalesProject.findUniqueOrThrow({ where: { id: opp.id } });
    expect(stillThere.name).toBe("[TEST] presales client-blocked");
    expect(stillThere.deletedAt).toBeNull();

    await prisma.presalesProject.delete({ where: { id: opp.id } });
  });

  it("presales: PM CAN create, update, soft-delete, and restore an opportunity; only Admin can permanently delete it", async () => {
    const { updatePresalesProject, deletePresalesProject, restorePresalesProject, permanentlyDeletePresalesProject } = await import(
      "@/app/presales/actions"
    );
    const opp = await prisma.presalesProject.create({ data: { name: "[TEST] presales pm-owned", createdById: pmAUserId } });

    actAs(pmAUserId);
    await updatePresalesProject(opp.id, { client: "[TEST] Acme Co", estimatedValue: 5000 });
    expect((await prisma.presalesProject.findUniqueOrThrow({ where: { id: opp.id } })).client).toBe("[TEST] Acme Co");

    await deletePresalesProject(opp.id);
    expect((await prisma.presalesProject.findUniqueOrThrow({ where: { id: opp.id } })).deletedAt).not.toBeNull();

    // PM cannot permanently delete, even after soft-deleting it themselves.
    await expect(permanentlyDeletePresalesProject(opp.id)).rejects.toThrow();

    await restorePresalesProject(opp.id);
    expect((await prisma.presalesProject.findUniqueOrThrow({ where: { id: opp.id } })).deletedAt).toBeNull();

    await deletePresalesProject(opp.id);
    actAs(adminUserId);
    await permanentlyDeletePresalesProject(opp.id);
    expect(await prisma.presalesProject.findUnique({ where: { id: opp.id } })).toBeNull();
  });

  it("presales: Lost is reversible, Open->Lost requires the OPEN state, and Won creates a real project", async () => {
    const { markPresalesLost, reopenPresalesProject, winPresalesProject } = await import("@/app/presales/actions");
    const lostOpp = await prisma.presalesProject.create({ data: { name: "[TEST] presales to lose", createdById: pmAUserId } });
    const wonOpp = await prisma.presalesProject.create({
      data: { name: "[TEST] presales to win", createdById: pmAUserId, client: "[TEST] Client", estimatedValue: 12000 },
    });
    const decision = await prisma.presalesDecisionItem.create({
      data: { presalesProjectId: wonOpp.id, decision: "[TEST] use React Native" },
    });
    const actionItem = await prisma.presalesActionItem.create({
      data: { presalesProjectId: wonOpp.id, description: "[TEST] send proposal" },
    });
    const checklistItem = await prisma.presalesChecklistItem.create({
      data: { presalesProjectId: wonOpp.id, order: 1, itemText: "[TEST] discovery call held", status: "COMPLETED" },
    });

    actAs(pmAUserId);
    try {
      await markPresalesLost(lostOpp.id, "[TEST] budget cut");
      let refreshed = await prisma.presalesProject.findUniqueOrThrow({ where: { id: lostOpp.id } });
      expect(refreshed.outcome).toBe("LOST");
      expect(refreshed.lostReason).toBe("[TEST] budget cut");

      // Can't mark an already-Lost opportunity Lost again — must reopen first.
      await expect(markPresalesLost(lostOpp.id, "again")).rejects.toThrow();

      await reopenPresalesProject(lostOpp.id);
      refreshed = await prisma.presalesProject.findUniqueOrThrow({ where: { id: lostOpp.id } });
      expect(refreshed.outcome).toBe("OPEN");
      expect(refreshed.lostReason).toBeNull();

      // winPresalesProject redirects on success; next/navigation is mocked
      // to throw (see the file-level vi.mock above) rather than actually
      // navigate, so all the DB writes complete first and then this rejects.
      await expect(winPresalesProject(wonOpp.id)).rejects.toThrow(/REDIRECT/);
      const won = await prisma.presalesProject.findUniqueOrThrow({ where: { id: wonOpp.id } });
      expect(won.outcome).toBe("WON");
      expect(won.wonProjectId).not.toBeNull();

      const newProject = await prisma.project.findUniqueOrThrow({ where: { id: won.wonProjectId! } });
      expect(newProject.name).toBe("[TEST] presales to win");
      expect(newProject.client).toBe("[TEST] Client");
      expect(newProject.contractValue).toBe(12000);
      // The standard checklist template should have been seeded, same as a
      // normal New Project — this is what "becomes a main project" means.
      const seededItems = await prisma.checklistItem.count({ where: { projectId: newProject.id } });
      expect(seededItems).toBeGreaterThan(0);

      // Decisions/action items logged during the pitch carry over.
      const carriedDecision = await prisma.decisionLogItem.findFirst({ where: { projectId: newProject.id, decision: "[TEST] use React Native" } });
      expect(carriedDecision).not.toBeNull();
      const carriedAction = await prisma.actionItem.findFirst({ where: { projectId: newProject.id, description: "[TEST] send proposal" } });
      expect(carriedAction).not.toBeNull();

      // Checklist items fold into the PM Checklist as their own "Presales"
      // stage, and count toward the project's overall completion — not
      // left behind as a separate historical record.
      const carriedChecklistItem = await prisma.checklistItem.findFirst({
        where: { projectId: newProject.id, itemText: "[TEST] discovery call held" },
      });
      expect(carriedChecklistItem).not.toBeNull();
      expect(carriedChecklistItem?.type).toBe("PM");
      expect(carriedChecklistItem?.stage).toBe("Presales");
      expect(carriedChecklistItem?.status).toBe("COMPLETED");
      expect(carriedChecklistItem!.order).toBeLessThan(0);

      const { getDashboardData } = await import("@/lib/dashboard-data");
      const dashboard = await getDashboardData(newProject.id);
      const presalesStage = dashboard.pmStageSummary.find((s) => s.stage === "Presales");
      expect(presalesStage).toBeDefined();
      expect(presalesStage?.total).toBe(1);
      expect(presalesStage?.completed).toBe(1);

      // Can't win it twice.
      await expect(winPresalesProject(wonOpp.id)).rejects.toThrow();

      await prisma.decisionLogItem.deleteMany({ where: { projectId: newProject.id } });
      await prisma.actionItem.deleteMany({ where: { projectId: newProject.id } });
      await prisma.checklistItem.deleteMany({ where: { projectId: newProject.id } });
      await prisma.project.delete({ where: { id: newProject.id } });
    } finally {
      await prisma.presalesDecisionItem.deleteMany({ where: { id: decision.id } });
      await prisma.presalesActionItem.deleteMany({ where: { id: actionItem.id } });
      await prisma.presalesChecklistItem.deleteMany({ where: { id: checklistItem.id } });
      await prisma.presalesProject.delete({ where: { id: lostOpp.id } });
      await prisma.presalesProject.deleteMany({ where: { id: wonOpp.id } });
    }
  });

  it("presales: PM can manage Decision Log / Action Items on an opportunity; CLIENT cannot", async () => {
    const { createPresalesDecision, updatePresalesDecision, deletePresalesDecision } = await import("@/app/presales/[id]/decision-actions");
    const { createPresalesActionItem, updatePresalesActionItem, deletePresalesActionItem } = await import(
      "@/app/presales/[id]/action-item-actions"
    );
    const opp = await prisma.presalesProject.create({ data: { name: "[TEST] presales decisions/actions", createdById: pmAUserId } });

    try {
      actAs(pmAUserId);
      await createPresalesDecision(opp.id);
      const decision = await prisma.presalesDecisionItem.findFirstOrThrow({ where: { presalesProjectId: opp.id } });
      await updatePresalesDecision(decision.id, opp.id, { decision: "[TEST] renamed" });
      expect((await prisma.presalesDecisionItem.findUniqueOrThrow({ where: { id: decision.id } })).decision).toBe("[TEST] renamed");

      await createPresalesActionItem(opp.id);
      const action = await prisma.presalesActionItem.findFirstOrThrow({ where: { presalesProjectId: opp.id } });
      await updatePresalesActionItem(action.id, opp.id, { status: "Done" });
      expect((await prisma.presalesActionItem.findUniqueOrThrow({ where: { id: action.id } })).status).toBe("Done");

      actAs(clientBUserId);
      await expect(createPresalesDecision(opp.id)).rejects.toThrow();
      await expect(updatePresalesDecision(decision.id, opp.id, { decision: "hacked" })).rejects.toThrow();
      await expect(createPresalesActionItem(opp.id)).rejects.toThrow();
      await expect(updatePresalesActionItem(action.id, opp.id, { status: "Open" })).rejects.toThrow();

      actAs(pmAUserId);
      await deletePresalesDecision(decision.id, opp.id);
      await deletePresalesActionItem(action.id, opp.id);
      expect(await prisma.presalesDecisionItem.findUnique({ where: { id: decision.id } })).toBeNull();
      expect(await prisma.presalesActionItem.findUnique({ where: { id: action.id } })).toBeNull();
    } finally {
      await prisma.presalesProject.delete({ where: { id: opp.id } });
    }
  });

  it("presales checklist template: Admin-only CRUD, and a new opportunity auto-seeds from it", async () => {
    const { createPresalesTemplateItem, updatePresalesTemplateItem, deletePresalesTemplateItem } = await import(
      "@/app/admin/checklist-template/presales-template-actions"
    );
    const { createPresalesProject } = await import("@/app/presales/actions");

    actAs(clientBUserId);
    await expect(createPresalesTemplateItem()).rejects.toThrow();

    actAs(adminUserId);
    await createPresalesTemplateItem();
    const created = await prisma.presalesChecklistTemplateItem.findFirstOrThrow({ where: { itemText: "New checklist item — click to edit" } });

    await updatePresalesTemplateItem(created.id, "[TEST] Discovery call held");
    expect((await prisma.presalesChecklistTemplateItem.findUniqueOrThrow({ where: { id: created.id } })).itemText).toBe("[TEST] Discovery call held");

    try {
      // createPresalesProject redirects on success (same REDIRECT-throw
      // pattern as winPresalesProject above).
      actAs(pmAUserId);
      const fd = new FormData();
      fd.set("name", "[TEST] auto-seeded opportunity");
      await expect(createPresalesProject(fd)).rejects.toThrow(/REDIRECT/);

      const opp = await prisma.presalesProject.findFirstOrThrow({
        where: { name: "[TEST] auto-seeded opportunity" },
        include: { checklistItems: true },
      });
      try {
        const seeded = opp.checklistItems.find((c) => c.itemText === "[TEST] Discovery call held");
        expect(seeded).toBeDefined();
        expect(seeded?.isCustom).toBe(false);
      } finally {
        await prisma.presalesProject.delete({ where: { id: opp.id } });
      }
    } finally {
      actAs(adminUserId);
      await deletePresalesTemplateItem(created.id);
      expect(await prisma.presalesChecklistTemplateItem.findUnique({ where: { id: created.id } })).toBeNull();
    }
  });

  it("presales checklist (per-opportunity): PM manages custom items; template item text is Admin-only; CLIENT is blocked", async () => {
    const { createPresalesChecklistItem, updatePresalesChecklistItem, deletePresalesChecklistItem } = await import(
      "@/app/presales/[id]/checklist-actions"
    );
    const opp = await prisma.presalesProject.create({ data: { name: "[TEST] presales checklist opp", createdById: pmAUserId } });
    const templateItem = await prisma.presalesChecklistItem.create({
      data: { presalesProjectId: opp.id, order: 1, itemText: "[TEST] seeded step", isCustom: false },
    });

    try {
      actAs(pmAUserId);
      await createPresalesChecklistItem(opp.id);
      const custom = await prisma.presalesChecklistItem.findFirstOrThrow({ where: { presalesProjectId: opp.id, isCustom: true } });

      // PM can freely edit a custom item's text and status.
      await updatePresalesChecklistItem(custom.id, opp.id, { itemText: "[TEST] custom step", status: "IN_PROGRESS" });
      const updatedCustom = await prisma.presalesChecklistItem.findUniqueOrThrow({ where: { id: custom.id } });
      expect(updatedCustom.itemText).toBe("[TEST] custom step");
      expect(updatedCustom.status).toBe("IN_PROGRESS");

      // PM can change a template item's status/dates, but not its wording.
      await updatePresalesChecklistItem(templateItem.id, opp.id, { status: "COMPLETED" });
      expect((await prisma.presalesChecklistItem.findUniqueOrThrow({ where: { id: templateItem.id } })).status).toBe("COMPLETED");
      await expect(updatePresalesChecklistItem(templateItem.id, opp.id, { itemText: "hacked wording" })).rejects.toThrow();

      // PM can delete a custom item, but not a template item.
      await expect(deletePresalesChecklistItem(templateItem.id, opp.id)).rejects.toThrow();
      await deletePresalesChecklistItem(custom.id, opp.id);
      expect(await prisma.presalesChecklistItem.findUnique({ where: { id: custom.id } })).toBeNull();

      // Admin CAN rename a template item's wording.
      actAs(adminUserId);
      await updatePresalesChecklistItem(templateItem.id, opp.id, { itemText: "[TEST] renamed by admin" });
      expect((await prisma.presalesChecklistItem.findUniqueOrThrow({ where: { id: templateItem.id } })).itemText).toBe("[TEST] renamed by admin");

      // CLIENT is blocked entirely.
      actAs(clientBUserId);
      await expect(createPresalesChecklistItem(opp.id)).rejects.toThrow();
      await expect(updatePresalesChecklistItem(templateItem.id, opp.id, { status: "BLOCKED" })).rejects.toThrow();
    } finally {
      await prisma.presalesProject.delete({ where: { id: opp.id } });
    }
  });
});
