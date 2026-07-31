"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireUser, writeAudit } from "@/lib/rbac";
import type { ItemStatus } from "@/lib/constants";

async function requirePresalesWrite() {
  const user = await requireUser();
  if (user.role !== "PM" && user.role !== "ADMIN") {
    throw new Error("Only a PM or Admin can manage presales opportunities.");
  }
  return user;
}

function revalidateChecklist(presalesProjectId: string) {
  revalidatePath(`/presales/${presalesProjectId}`);
}

type ChecklistUpdateData = Partial<{
  itemText: string;
  ownerPersonId: string | null;
  plannedDate: string | null;
  forecastDate: string | null;
  status: ItemStatus;
  notes: string;
}>;

function toPrismaData(data: ChecklistUpdateData) {
  return {
    ...(data.itemText !== undefined ? { itemText: data.itemText } : {}),
    ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
    ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
    ...(data.forecastDate !== undefined ? { forecastDate: parseDateInput(data.forecastDate) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
  };
}

export async function createPresalesChecklistItem(presalesProjectId: string) {
  const user = await requirePresalesWrite();

  const { _max } = await prisma.presalesChecklistItem.aggregate({ where: { presalesProjectId }, _max: { order: true } });
  const created = await prisma.presalesChecklistItem.create({
    data: { presalesProjectId, order: (_max.order ?? 0) + 1, itemText: "New checklist item — click to edit", isCustom: true },
  });

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "PresalesChecklistItem",
    entityId: created.id,
    summary: "Added a custom presales checklist item",
  });

  revalidateChecklist(presalesProjectId);
}

export async function updatePresalesChecklistItem(id: string, presalesProjectId: string, data: ChecklistUpdateData) {
  const existing = await prisma.presalesChecklistItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  // Same rule as the real checklist: renaming a fixed template item's
  // wording is Admin-only, enforced here (not just hidden in the UI).
  if (data.itemText !== undefined && !existing.isCustom && user.role !== "ADMIN") {
    throw new Error("Only an Admin can rename a fixed checklist item's wording.");
  }

  await prisma.presalesChecklistItem.update({ where: { id }, data: toPrismaData(data) });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesChecklistItem",
    entityId: id,
    summary: `Updated presales checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateChecklist(existing.presalesProjectId);
}

export async function deletePresalesChecklistItem(id: string, _presalesProjectId: string) {
  const existing = await prisma.presalesChecklistItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  if (!existing.isCustom) {
    throw new Error("Fixed template items can't be deleted — only custom items you added.");
  }

  await prisma.presalesChecklistItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "PresalesChecklistItem",
    entityId: id,
    summary: `Deleted custom presales checklist item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateChecklist(existing.presalesProjectId);
}
