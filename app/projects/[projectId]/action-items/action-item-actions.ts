"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateActionItems(projectId: string) {
  revalidatePath(`/projects/${projectId}/action-items`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createActionItem(projectId: string) {
  const user = await requireModuleWrite(projectId, "ACTION_ITEMS");

  const count = await prisma.actionItem.count({ where: { projectId } });
  const created = await prisma.actionItem.create({
    data: { projectId, description: "New action item", order: count },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ActionItem",
    entityId: created.id,
    summary: "Added a new action item",
  });

  revalidateActionItems(projectId);
}

export async function updateActionItem(
  id: string,
  projectId: string,
  data: Partial<{
    description: string;
    ownerPersonId: string | null;
    dueDate: string | null;
    status: string;
    notes: string;
  }>
) {
  // Guessed-ID fix: authorize against the action item's real project.
  const existing = await prisma.actionItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "ACTION_ITEMS");

  await prisma.actionItem.update({
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
    projectId: existing.projectId,
    action: "update",
    entityType: "ActionItem",
    entityId: id,
    summary: `Updated action item "${existing.description.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateActionItems(existing.projectId);
}

export async function deleteActionItem(id: string, _projectId: string) {
  const existing = await prisma.actionItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "ACTION_ITEMS");

  await prisma.actionItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "ActionItem",
    entityId: id,
    summary: `Deleted action item "${existing.description.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateActionItems(existing.projectId);
}
