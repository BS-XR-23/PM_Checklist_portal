"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, performTpmOverride, writeAudit } from "@/lib/rbac";
import type { ItemStatus } from "@/lib/constants";
import { CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import type { ModuleName } from "@prisma/client";

function moduleFor(checklistType: ChecklistType): ModuleName {
  return CHECKLIST_TYPE_BY_KEY[checklistType].moduleName;
}

function revalidateChecklist(projectId: string, checklistType: ChecklistType) {
  const config = CHECKLIST_TYPE_BY_KEY[checklistType];
  // DEV's real page lives under Delivery, not the general /checklist/[type]
  // route (see inGeneralChecklistNav) — revalidate wherever it's actually
  // rendered.
  revalidatePath(config.inGeneralChecklistNav ? `/projects/${projectId}/checklist/${config.routeSegment}` : `/projects/${projectId}/delivery/checklist`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/activity`);
}

type ChecklistUpdateData = Partial<{
  itemText: string;
  owner: string;
  ownerPersonId: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  link: string;
  status: ItemStatus;
  notes: string;
}>;

function toPrismaData(data: ChecklistUpdateData) {
  return {
    ...(data.itemText !== undefined ? { itemText: data.itemText } : {}),
    ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
    ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
    ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
    ...(data.actualDate !== undefined ? { actualDate: parseDateInput(data.actualDate) } : {}),
    ...(data.link !== undefined ? { link: data.link || null } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
  };
}

export async function updateChecklistItem(itemId: string, projectId: string, checklistType: ChecklistType, data: ChecklistUpdateData) {
  // Guessed-ID fix: never trust the caller's projectId — look up the item's
  // real project and authorize against that.
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, moduleFor(checklistType));

  // Renaming wording: a PM may only rename an item they added themselves;
  // renaming a fixed template item's text is Admin-only, enforced here (not
  // just hidden in the UI) so a crafted request can't bypass it.
  if (data.itemText !== undefined && !existing.isCustom && user.role !== "ADMIN") {
    throw new Error("Only an Admin can rename a fixed checklist item's wording.");
  }

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

/** Special-case escape hatch: a project-specific step the fixed template doesn't cover. */
export async function createChecklistItem(projectId: string, checklistType: ChecklistType, stage: string) {
  const user = await requireModuleWrite(projectId, moduleFor(checklistType));

  const { _max } = await prisma.checklistItem.aggregate({
    where: { projectId, type: checklistType },
    _max: { order: true },
  });

  const created = await prisma.checklistItem.create({
    data: {
      projectId,
      type: checklistType,
      order: (_max.order ?? 0) + 1,
      stage,
      itemText: "New checklist item — click to edit",
      isCustom: true,
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ChecklistItem",
    entityId: created.id,
    summary: `Added a custom checklist item to "${stage}"`,
  });

  revalidateChecklist(projectId, checklistType);
}

export async function deleteChecklistItem(itemId: string, projectId: string, checklistType: ChecklistType) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, moduleFor(checklistType));

  if (!existing.isCustom) {
    throw new Error("Fixed template items can't be deleted — only custom items you added.");
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "ChecklistItem",
    entityId: itemId,
    summary: `Deleted custom checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateChecklist(existing.projectId, checklistType);
}
