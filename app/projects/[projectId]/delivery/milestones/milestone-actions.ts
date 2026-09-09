"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import type { MilestoneType } from "@prisma/client";

// Delivery Milestones are development delivery checkpoints (MVP Complete,
// UAT Ready, Production Release, ...) — a completely separate feature from
// "Milestones & Payments" (app/projects/[projectId]/milestones), which
// tracks payment tranches tied to checklist sign-off. Different goals, not
// to be conflated: gated on DELIVERY (not MILESTONES), and never touches
// MilestonePayment/ChecklistItem.

function revalidateMilestones(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery/milestones`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createMilestone(
  projectId: string,
  input: { name: string; type: MilestoneType; plannedDate?: string | null; ownerPersonId?: string | null }
) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const { _max } = await prisma.milestone.aggregate({ where: { projectId }, _max: { order: true } });
  const created = await prisma.milestone.create({
    data: {
      projectId,
      name: input.name,
      type: input.type,
      order: (_max.order ?? 0) + 1,
      plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
      ownerPersonId: input.ownerPersonId || null,
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "Milestone",
    entityId: created.id,
    summary: `Added milestone "${input.name}"`,
  });

  revalidateMilestones(projectId);
  return created;
}

export async function updateMilestone(
  id: string,
  projectId: string,
  data: Partial<{
    name: string;
    type: MilestoneType;
    description: string | null;
    plannedDate: string | null;
    forecastDate: string | null;
    actualDate: string | null;
    status: string;
    pctComplete: number;
    ownerPersonId: string | null;
    acceptanceCriteria: string | null;
    dependenciesNote: string | null;
  }>
) {
  const existing = await prisma.milestone.findUniqueOrThrow({ where: { id } });
  // Guessed-ID fix: authorize against the milestone's real project, not the caller's claim.
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  await prisma.milestone.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.plannedDate !== undefined ? { plannedDate: data.plannedDate ? new Date(data.plannedDate) : null } : {}),
      ...(data.forecastDate !== undefined ? { forecastDate: data.forecastDate ? new Date(data.forecastDate) : null } : {}),
      ...(data.actualDate !== undefined ? { actualDate: data.actualDate ? new Date(data.actualDate) : null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.pctComplete !== undefined ? { pctComplete: data.pctComplete } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId || null } : {}),
      ...(data.acceptanceCriteria !== undefined ? { acceptanceCriteria: data.acceptanceCriteria || null } : {}),
      ...(data.dependenciesNote !== undefined ? { dependenciesNote: data.dependenciesNote || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "Milestone",
    entityId: id,
    summary: `Updated milestone "${existing.name}"`,
    diff: { before: existing, changes: data },
  });

  revalidateMilestones(existing.projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMilestone(id: string, _projectId: string) {
  const existing = await prisma.milestone.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  await prisma.milestone.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "Milestone",
    entityId: id,
    summary: `Deleted milestone "${existing.name}"`,
    diff: { before: existing },
  });

  revalidateMilestones(existing.projectId);
}
