"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireUser, writeAudit } from "@/lib/rbac";

async function requirePresalesWrite() {
  const user = await requireUser();
  if (user.role !== "PM" && user.role !== "ADMIN") {
    throw new Error("Only a PM or Admin can manage presales opportunities.");
  }
  return user;
}

function revalidateActionItems(presalesProjectId: string) {
  revalidatePath(`/presales/${presalesProjectId}`);
}

export async function createPresalesActionItem(presalesProjectId: string) {
  const user = await requirePresalesWrite();

  const count = await prisma.presalesActionItem.count({ where: { presalesProjectId } });
  const created = await prisma.presalesActionItem.create({
    data: { presalesProjectId, description: "New action item", order: count },
  });

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "PresalesActionItem",
    entityId: created.id,
    summary: "Added a new presales action item",
  });

  revalidateActionItems(presalesProjectId);
}

export async function updatePresalesActionItem(
  id: string,
  presalesProjectId: string,
  data: Partial<{
    description: string;
    ownerPersonId: string | null;
    dueDate: string | null;
    status: string;
    notes: string;
  }>
) {
  const existing = await prisma.presalesActionItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  await prisma.presalesActionItem.update({
    where: { id },
    data: {
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
      ...(data.dueDate !== undefined ? { dueDate: parseDateInput(data.dueDate) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesActionItem",
    entityId: id,
    summary: `Updated presales action item "${existing.description.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateActionItems(existing.presalesProjectId);
}

export async function deletePresalesActionItem(id: string, _presalesProjectId: string) {
  const existing = await prisma.presalesActionItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  await prisma.presalesActionItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "PresalesActionItem",
    entityId: id,
    summary: `Deleted presales action item "${existing.description.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateActionItems(existing.presalesProjectId);
}
