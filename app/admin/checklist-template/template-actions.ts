"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import type { ChecklistType } from "@/lib/checklist-types";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can edit the checklist template.");
  }
  return user;
}

function revalidateTemplate() {
  revalidatePath("/admin/checklist-template");
}

export async function createTemplateItem(type: ChecklistType, stage: string) {
  const user = await requireAdmin();

  const { _max } = await prisma.checklistTemplateItem.aggregate({ where: { type }, _max: { order: true } });

  const created = await prisma.checklistTemplateItem.create({
    data: { type, order: (_max.order ?? 0) + 1, stage, itemText: "New checklist item — click to edit" },
  });

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "ChecklistTemplateItem",
    entityId: created.id,
    summary: `Added a template item to "${stage}" (${type})`,
  });

  revalidateTemplate();
}

export async function updateTemplateItem(id: string, data: Partial<{ itemText: string; milestoneName: string | null }>) {
  const user = await requireAdmin();
  const existing = await prisma.checklistTemplateItem.findUniqueOrThrow({ where: { id } });

  await prisma.checklistTemplateItem.update({
    where: { id },
    data: {
      ...(data.itemText !== undefined ? { itemText: data.itemText } : {}),
      ...(data.milestoneName !== undefined ? { milestoneName: data.milestoneName || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "ChecklistTemplateItem",
    entityId: id,
    summary: `Updated template item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateTemplate();
}

export async function deleteTemplateItem(id: string) {
  const user = await requireAdmin();
  const existing = await prisma.checklistTemplateItem.findUniqueOrThrow({ where: { id } });

  await prisma.checklistTemplateItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "ChecklistTemplateItem",
    entityId: id,
    summary: `Deleted template item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateTemplate();
}

/** Reorders within the item's own (type, stage) group only — never crosses into an adjacent stage. */
export async function moveTemplateItem(id: string, direction: "up" | "down") {
  const user = await requireAdmin();
  const existing = await prisma.checklistTemplateItem.findUniqueOrThrow({ where: { id } });

  const siblings = await prisma.checklistTemplateItem.findMany({
    where: { type: existing.type, stage: existing.stage },
    orderBy: { order: "asc" },
  });
  const index = siblings.findIndex((s) => s.id === id);
  const swapWithIndex = direction === "up" ? index - 1 : index + 1;
  if (swapWithIndex < 0 || swapWithIndex >= siblings.length) return; // already at this stage's boundary

  const other = siblings[swapWithIndex];
  // @@unique([type, order]) is checked immediately (not deferred), so a
  // direct two-way swap would collide mid-transaction — stage through a
  // value no sibling ever uses (seeded orders start at 1).
  await prisma.$transaction([
    prisma.checklistTemplateItem.update({ where: { id: existing.id }, data: { order: -1 } }),
    prisma.checklistTemplateItem.update({ where: { id: other.id }, data: { order: existing.order } }),
    prisma.checklistTemplateItem.update({ where: { id: existing.id }, data: { order: other.order } }),
  ]);

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "ChecklistTemplateItem",
    entityId: id,
    summary: `Moved template item "${existing.itemText.slice(0, 60)}" ${direction}`,
  });

  revalidateTemplate();
}
