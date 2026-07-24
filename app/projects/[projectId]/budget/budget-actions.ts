"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

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
