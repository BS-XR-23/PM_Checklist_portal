"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, performTpmOverride, writeAudit } from "@/lib/rbac";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { checklistActualDateForStatus, normalizeLink } from "@/lib/checklist";
import type { ChecklistItem } from "@prisma/client";

// Every action authorizes against the type stored on the item itself, never
// one the browser sends — otherwise edit rights on one checklist (say
// DevOps) would open up every other checklist on the same project.
function configFor(type: string) {
  const config = CHECKLIST_TYPE_BY_KEY[type as ChecklistType];
  if (!config) throw new Error(`Unknown checklist type "${type}".`);
  return config;
}

function revalidateChecklist(projectId: string, checklistType: string) {
  const config = configFor(checklistType);
  // DEV's real page lives under Delivery, not the general /checklist/[type]
  // route (see inGeneralChecklistNav) — revalidate wherever it's actually
  // rendered.
  revalidatePath(config.inGeneralChecklistNav ? `/projects/${projectId}/checklist/${config.routeSegment}` : `/projects/${projectId}/delivery/checklist`);
  revalidatePath(`/projects/${projectId}/checklist/qms`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/activity`);
  revalidatePath("/projects");
  revalidatePath("/portfolio");
  revalidatePath("/notifications");
}

type ChecklistUpdateData = Partial<{
  itemText: string;
  ownerPersonId: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  link: string;
  status: ItemStatus;
  notes: string;
  isRecurring: boolean;
}>;

function toPrismaData(existing: ChecklistItem, data: ChecklistUpdateData) {
  if (data.itemText !== undefined && !data.itemText.trim()) throw new Error("The item needs some wording.");
  if (data.status !== undefined && !ITEM_STATUSES.includes(data.status)) throw new Error(`Unknown status "${data.status}".`);

  let actualDate = data.actualDate !== undefined ? parseDateInput(data.actualDate) : undefined;
  // Completing stamps today when no actual date is set; reopening a
  // completed item clears the date it was done (lib/checklist.ts).
  if (data.status !== undefined && data.status !== existing.status) {
    const auto = checklistActualDateForStatus(existing.status, data.status, actualDate !== undefined ? actualDate : existing.actualDate, new Date(new Date().setHours(0, 0, 0, 0)));
    if (auto !== undefined) actualDate = auto;
  }

  return {
    ...(data.itemText !== undefined ? { itemText: data.itemText.trim() } : {}),
    ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
    ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
    ...(actualDate !== undefined ? { actualDate } : {}),
    ...(data.link !== undefined ? { link: normalizeLink(data.link) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
    ...(data.isRecurring !== undefined ? { isRecurring: data.isRecurring } : {}),
  };
}

export async function updateChecklistItem(itemId: string, data: ChecklistUpdateData) {
  // Guessed-ID fix: look up the item's real project and type and authorize
  // against those.
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, configFor(existing.type).moduleName);

  // Renaming wording: a PM may only rename an item they added themselves;
  // renaming a fixed template item's text is Admin-only, enforced here (not
  // just hidden in the UI) so a crafted request can't bypass it.
  if (data.itemText !== undefined && !existing.isCustom && user.role !== "ADMIN") {
    throw new Error("Only an Admin can rename a fixed checklist item's wording.");
  }

  await prisma.checklistItem.update({ where: { id: itemId }, data: toPrismaData(existing, data) });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "ChecklistItem",
    entityId: itemId,
    summary: `Updated checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateChecklist(existing.projectId, existing.type);
}

export async function tpmOverrideChecklistItem(itemId: string, data: Omit<ChecklistUpdateData, "itemText" | "isRecurring">, reason: string) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const prismaData = toPrismaData(existing, data);

  await performTpmOverride({
    projectId: existing.projectId,
    module: configFor(existing.type).moduleName,
    entityType: "ChecklistItem",
    entityId: itemId,
    reason,
    summary: `edited checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
    mutate: () => prisma.checklistItem.update({ where: { id: itemId }, data: prismaData }),
  });

  revalidateChecklist(existing.projectId, existing.type);
}

/** Keeps "Last done" on the item equal to its newest log (null once none are left). */
async function syncLastDone(itemId: string) {
  const { _max } = await prisma.checklistOccurrence.aggregate({ where: { checklistItemId: itemId }, _max: { date: true } });
  await prisma.checklistItem.update({ where: { id: itemId }, data: { actualDate: _max.date } });
}

/** Records one occurrence of a recurring item, with the evidence that it happened. */
export async function logChecklistOccurrence(itemId: string, input: { date: string; link: string; notes?: string }) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, configFor(existing.type).moduleName);
  if (!existing.isRecurring) throw new Error("Only an ongoing cadence item can be logged.");

  const date = parseDateInput(input.date);
  if (!date) throw new Error("Choose the date it happened.");
  const link = normalizeLink(input.link);
  if (!link) throw new Error("Add a link to the evidence.");

  const sprint = await prisma.sprint.findFirst({
    where: { projectId: existing.projectId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });

  const created = await prisma.checklistOccurrence.create({
    data: { checklistItemId: itemId, date, link, notes: input.notes?.trim() || null, sprintId: sprint?.id ?? null, recordedByName: user.name },
  });
  await syncLastDone(itemId);

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "create",
    entityType: "ChecklistOccurrence",
    entityId: created.id,
    summary: `Logged "${existing.itemText.slice(0, 60)}"`,
  });

  revalidateChecklist(existing.projectId, existing.type);
}

export async function deleteChecklistOccurrence(occurrenceId: string) {
  const existing = await prisma.checklistOccurrence.findUniqueOrThrow({ where: { id: occurrenceId }, include: { checklistItem: true } });
  const { checklistItem: item, ...occurrence } = existing;
  const user = await requireModuleWrite(item.projectId, configFor(item.type).moduleName);

  await prisma.checklistOccurrence.delete({ where: { id: occurrenceId } });
  await syncLastDone(item.id);

  await writeAudit({
    actor: user,
    projectId: item.projectId,
    action: "delete",
    entityType: "ChecklistOccurrence",
    entityId: occurrenceId,
    summary: `Removed a log of "${item.itemText.slice(0, 60)}"`,
    diff: { before: occurrence },
  });

  revalidateChecklist(item.projectId, item.type);
}

/** Special-case escape hatch: a project-specific step the fixed template doesn't cover. */
export async function createChecklistItem(projectId: string, checklistType: ChecklistType, stage: string, itemText: string) {
  const config = configFor(checklistType);
  const user = await requireModuleWrite(projectId, config.moduleName);
  if (!config.stageOrder.includes(stage)) throw new Error(`"${stage}" isn't a ${config.stageLabel.toLowerCase()} of the ${config.label}.`);
  const text = itemText.trim();
  if (!text) throw new Error("The item needs some wording.");

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
      itemText: text,
      isCustom: true,
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ChecklistItem",
    entityId: created.id,
    summary: `Added a custom checklist item to "${stage}": "${text.slice(0, 60)}"`,
  });

  revalidateChecklist(projectId, checklistType);
}

export async function deleteChecklistItem(itemId: string) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireModuleWrite(existing.projectId, configFor(existing.type).moduleName);

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

  revalidateChecklist(existing.projectId, existing.type);
}
