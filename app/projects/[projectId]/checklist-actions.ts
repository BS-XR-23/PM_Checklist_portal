"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, performTpmOverride, writeAudit } from "@/lib/rbac";
import type { ChecklistType, ItemStatus } from "@/lib/constants";
import type { ModuleName } from "@prisma/client";

function moduleFor(checklistType: ChecklistType): ModuleName {
  return checklistType === "PM" ? "PM_CHECKLIST" : "DEVOPS_CHECKLIST";
}

function revalidateChecklist(projectId: string, checklistType: ChecklistType) {
  const path = checklistType === "PM" ? "pm-checklist" : "devops-checklist";
  revalidatePath(`/projects/${projectId}/${path}`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/activity`);
}

type ChecklistUpdateData = Partial<{
  owner: string;
  ownerPersonId: string | null;
  plannedDate: string | null;
  forecastDate: string | null;
  status: ItemStatus;
  notes: string;
}>;

function toPrismaData(data: ChecklistUpdateData) {
  return {
    ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
    ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
    ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
    ...(data.forecastDate !== undefined ? { forecastDate: parseDateInput(data.forecastDate) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
  };
}

export async function updateChecklistItem(itemId: string, projectId: string, checklistType: ChecklistType, data: ChecklistUpdateData) {
  // Guessed-ID fix: never trust the caller's projectId — look up the item's
  // real project and authorize against that.
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, moduleFor(checklistType));

  await prisma.checklistItem.update({ where: { id: itemId }, data: toPrismaData(data) });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "ChecklistItem",
    entityId: itemId,
    summary: `Updated checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateChecklist(existing.projectId, checklistType);
}

export async function tpmOverrideChecklistItem(
  itemId: string,
  projectId: string,
  checklistType: ChecklistType,
  data: ChecklistUpdateData,
  reason: string
) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });

  await performTpmOverride({
    projectId: existing.projectId,
    module: moduleFor(checklistType),
    entityType: "ChecklistItem",
    entityId: itemId,
    reason,
    summary: `edited checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
    mutate: () => prisma.checklistItem.update({ where: { id: itemId }, data: toPrismaData(data) }),
  });

  revalidateChecklist(existing.projectId, checklistType);
}
