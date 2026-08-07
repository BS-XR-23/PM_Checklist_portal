"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import { checklistCompletionPct, sumRoleCosts } from "@/lib/calculations";

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createBudgetEntry(projectId: string) {
  const user = await requireModuleWrite(projectId, "BUDGET_TRACKER");

  const last = await prisma.budgetEntry.findFirst({ where: { projectId }, orderBy: { weekEnding: "desc" } });
  const nextWeek = last ? new Date(last.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();

  const created = await prisma.budgetEntry.create({
    data: { projectId, weekEnding: nextWeek, pctPlannedComplete: 0, pctActualComplete: 0, actualCost: 0 },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "BudgetEntry", entityId: created.id, summary: "Added a weekly budget entry" });

  revalidateBudget(projectId);
}

export async function updateBudgetEntry(
  id: string,
  projectId: string,
  data: Partial<{ weekEnding: string; pctPlannedComplete: number; pctActualComplete: number; actualCost: number; notes: string }>
) {
  // Guessed-ID fix: authorize against the entry's real project.
  const existing = await prisma.budgetEntry.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "BUDGET_TRACKER");

  await prisma.budgetEntry.update({
    where: { id },
    data: {
      ...(data.weekEnding !== undefined ? { weekEnding: parseDateInput(data.weekEnding) ?? new Date() } : {}),
      ...(data.pctPlannedComplete !== undefined ? { pctPlannedComplete: data.pctPlannedComplete } : {}),
      ...(data.pctActualComplete !== undefined ? { pctActualComplete: data.pctActualComplete } : {}),
      ...(data.actualCost !== undefined ? { actualCost: data.actualCost } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "BudgetEntry",
    entityId: id,
    summary: `Updated budget entry for week ending ${existing.weekEnding.toISOString().slice(0, 10)}`,
    diff: { before: existing, changes: data },
  });

  revalidateBudget(existing.projectId);
}

export async function deleteBudgetEntry(id: string, _projectId: string) {
  const existing = await prisma.budgetEntry.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "BUDGET_TRACKER");

  await prisma.budgetEntry.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "BudgetEntry",
    entityId: id,
    summary: `Deleted budget entry for week ending ${existing.weekEnding.toISOString().slice(0, 10)}`,
    diff: { before: existing },
  });

  revalidateBudget(existing.projectId);
}

/** % Actual Complete now comes from the checklist's own live completion —
 * pulled on demand (not silently re-synced on every render) so a PM
 * controls exactly when a week's Earned Value gets locked in. */
export async function syncActualCompleteFromChecklist(entryId: string, _projectId: string) {
  const existing = await prisma.budgetEntry.findUniqueOrThrow({ where: { id: entryId } });
  const user = await requireModuleWrite(existing.projectId, "BUDGET_TRACKER");

  const items = await prisma.checklistItem.findMany({ where: { projectId: existing.projectId }, select: { status: true } });
  const pctActualComplete = checklistCompletionPct(items);

  await prisma.budgetEntry.update({ where: { id: entryId }, data: { pctActualComplete } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "BudgetEntry",
    entityId: entryId,
    summary: `Synced % Actual Complete from checklist (${(pctActualComplete * 100).toFixed(1)}%)`,
    diff: { before: { pctActualComplete: existing.pctActualComplete }, changes: { pctActualComplete } },
  });

  revalidateBudget(existing.projectId);
}

// --- Actual Cost breakdown, by role ---
//
// BudgetEntry.actualCost is a cache of Σ(manDays x manDayRate) across a
// week's BudgetEntryRoleCost rows — recomputed here after every mutation
// rather than derived at read time, so computeEvm() doesn't need to change.

async function recomputeActualCost(budgetEntryId: string) {
  const rows = await prisma.budgetEntryRoleCost.findMany({ where: { budgetEntryId }, select: { manDays: true, manDayRate: true } });
  const actualCost = sumRoleCosts(rows);
  await prisma.budgetEntry.update({ where: { id: budgetEntryId }, data: { actualCost } });
}

export async function addBudgetEntryRoleCost(budgetEntryId: string, _projectId: string) {
  const entry = await prisma.budgetEntry.findUniqueOrThrow({ where: { id: budgetEntryId } });
  const user = await requireModuleWrite(entry.projectId, "BUDGET_TRACKER");

  const created = await prisma.budgetEntryRoleCost.create({
    data: { budgetEntryId, roleRateId: null, roleName: "", manDayRate: 0, manDays: 0 },
  });

  await writeAudit({ actor: user, projectId: entry.projectId, action: "create", entityType: "BudgetEntryRoleCost", entityId: created.id, summary: "Added a role to the actual-cost breakdown" });
  revalidateBudget(entry.projectId);
}

export async function updateBudgetEntryRoleCost(id: string, _projectId: string, data: { roleRateId?: string; manDays?: number }) {
  const existing = await prisma.budgetEntryRoleCost.findUniqueOrThrow({ where: { id }, include: { budgetEntry: true } });
  const user = await requireModuleWrite(existing.budgetEntry.projectId, "BUDGET_TRACKER");

  // Changing role re-snapshots roleName/manDayRate from the current
  // RoleRate — a later rename/deletion of that RoleRate must not rewrite
  // history, so we copy the values now rather than keep a live join.
  let roleFields: { roleRateId?: string | null; roleName?: string; manDayRate?: number } = {};
  if (data.roleRateId !== undefined) {
    const roleRate = await prisma.roleRate.findUniqueOrThrow({ where: { id: data.roleRateId } });
    roleFields = { roleRateId: roleRate.id, roleName: roleRate.roleName, manDayRate: roleRate.manDayRate };
  }

  await prisma.budgetEntryRoleCost.update({
    where: { id },
    data: { ...roleFields, ...(data.manDays !== undefined ? { manDays: data.manDays } : {}) },
  });

  await recomputeActualCost(existing.budgetEntryId);

  await writeAudit({
    actor: user,
    projectId: existing.budgetEntry.projectId,
    action: "update",
    entityType: "BudgetEntryRoleCost",
    entityId: id,
    summary: "Updated a role in the actual-cost breakdown",
    diff: { before: existing, changes: data },
  });

  revalidateBudget(existing.budgetEntry.projectId);
}

export async function deleteBudgetEntryRoleCost(id: string, _projectId: string) {
  const existing = await prisma.budgetEntryRoleCost.findUniqueOrThrow({ where: { id }, include: { budgetEntry: true } });
  const user = await requireModuleWrite(existing.budgetEntry.projectId, "BUDGET_TRACKER");

  await prisma.budgetEntryRoleCost.delete({ where: { id } });
  await recomputeActualCost(existing.budgetEntryId);

  await writeAudit({
    actor: user,
    projectId: existing.budgetEntry.projectId,
    action: "delete",
    entityType: "BudgetEntryRoleCost",
    entityId: id,
    summary: "Removed a role from the actual-cost breakdown",
    diff: { before: existing },
  });

  revalidateBudget(existing.budgetEntry.projectId);
}
