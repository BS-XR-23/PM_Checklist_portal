"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can edit the presales checklist template.");
  }
  return user;
}

function revalidateTemplate() {
  revalidatePath("/admin/checklist-template");
}

export async function createPresalesTemplateItem() {
  const user = await requireAdmin();

  const { _max } = await prisma.presalesChecklistTemplateItem.aggregate({ _max: { order: true } });

  const created = await prisma.presalesChecklistTemplateItem.create({
    data: { order: (_max.order ?? 0) + 1, itemText: "New checklist item — click to edit" },
  });

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "PresalesChecklistTemplateItem",
    entityId: created.id,
    summary: "Added a presales checklist template item",
  });

  revalidateTemplate();
}

export async function updatePresalesTemplateItem(id: string, itemText: string) {
  const user = await requireAdmin();
  const existing = await prisma.presalesChecklistTemplateItem.findUniqueOrThrow({ where: { id } });

  await prisma.presalesChecklistTemplateItem.update({ where: { id }, data: { itemText } });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesChecklistTemplateItem",
    entityId: id,
    summary: `Updated presales template item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing, changes: { itemText } },
  });

  revalidateTemplate();
}

export async function deletePresalesTemplateItem(id: string) {
  const user = await requireAdmin();
  const existing = await prisma.presalesChecklistTemplateItem.findUniqueOrThrow({ where: { id } });

  await prisma.presalesChecklistTemplateItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "PresalesChecklistTemplateItem",
    entityId: id,
    summary: `Deleted presales template item "${existing.itemText.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateTemplate();
}
