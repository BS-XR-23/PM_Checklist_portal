"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess, writeAudit } from "@/lib/rbac";

async function requireEscalationAccess(projectId: string) {
  const user = await requireUser();
  await requireProjectAccess(projectId);
  if (user.role !== "TPM" && user.role !== "ADMIN") {
    throw new Error("Only a TPM (or Admin) can use the escalation layer.");
  }
  return user;
}

export async function createEscalation(projectId: string, type: string, title: string) {
  const user = await requireEscalationAccess(projectId);

  const created = await prisma.escalationItem.create({
    data: { projectId, type, title, createdById: user.id },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "EscalationItem",
    entityId: created.id,
    summary: `Raised escalation "${title}" (${type})`,
  });

  revalidatePath(`/projects/${projectId}/escalations`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function updateEscalation(id: string, projectId: string, data: Partial<{ notes: string; status: string }>) {
  const existing = await prisma.escalationItem.findUniqueOrThrow({ where: { id } });
  if (existing.projectId !== projectId) throw new Error("Escalation does not belong to this project.");
  const user = await requireEscalationAccess(existing.projectId ?? projectId);

  await prisma.escalationItem.update({
    where: { id },
    data: {
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "EscalationItem",
    entityId: id,
    summary: `Updated escalation "${existing.title}"`,
    diff: { before: existing, changes: data },
  });

  revalidatePath(`/projects/${projectId}/escalations`);
  revalidatePath(`/projects/${projectId}/activity`);
}
