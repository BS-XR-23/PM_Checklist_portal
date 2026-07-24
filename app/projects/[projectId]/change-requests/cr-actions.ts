"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateCrLog(projectId: string) {
  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createChangeRequest(projectId: string) {
  const user = await requireModuleWrite(projectId, "CR_LOG");

  const existing = await prisma.changeRequest.findMany({ where: { projectId }, select: { crCode: true } });
  const maxNum = existing.reduce((max, cr) => {
    const n = parseInt(cr.crCode.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const crCode = `CR-${String(maxNum + 1).padStart(3, "0")}`;

  const created = await prisma.changeRequest.create({
    data: { projectId, crCode, title: "New change request" },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "ChangeRequest", entityId: created.id, summary: `Added ${crCode}` });

  revalidateCrLog(projectId);
}

export async function updateChangeRequest(
  id: string,
  projectId: string,
  data: Partial<{
    title: string;
    dateRaised: string | null;
    description: string;
    manDaysPlanned: number | null;
    billableManDays: number | null;
    rate: number | null;
    type: string;
    clientSignoff: string;
    wbsUpdated: string;
    status: string;
    notes: string;
  }>
) {
  // Guessed-ID fix: authorize against the CR's real project.
  const existing = await prisma.changeRequest.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "CR_LOG");

  await prisma.changeRequest.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.dateRaised !== undefined ? { dateRaised: parseDateInput(data.dateRaised) } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.manDaysPlanned !== undefined ? { manDaysPlanned: data.manDaysPlanned } : {}),
      ...(data.billableManDays !== undefined ? { billableManDays: data.billableManDays } : {}),
      ...(data.rate !== undefined ? { rate: data.rate } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.clientSignoff !== undefined ? { clientSignoff: data.clientSignoff } : {}),
      ...(data.wbsUpdated !== undefined ? { wbsUpdated: data.wbsUpdated } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "ChangeRequest",
    entityId: id,
    summary: `Updated ${existing.crCode}`,
    diff: { before: existing, changes: data },
  });

  revalidateCrLog(existing.projectId);
}

export async function deleteChangeRequest(id: string, _projectId: string) {
  const existing = await prisma.changeRequest.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "CR_LOG");

  await prisma.changeRequest.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "ChangeRequest",
    entityId: id,
    summary: `Deleted ${existing.crCode}`,
    diff: { before: existing },
  });

  revalidateCrLog(existing.projectId);
}
