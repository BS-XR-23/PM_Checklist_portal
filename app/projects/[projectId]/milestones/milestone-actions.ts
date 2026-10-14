"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import type { MilestoneType } from "@prisma/client";

// Milestones are the project's client-facing delivery commitments (MVP
// delivered, UAT complete, Go-Live, ...) and the only thing that carries a
// payment tranche, invoice status, and client sign-off. They have one home —
// the "Milestones & Payments" tab — and are gated on the MILESTONES module.
// PM Plan, Dashboard, Delivery, and Portfolio only read them.
//
// Checklist items tagged with a name are internal "gates", not milestones:
// they never create or own a payment (see docs/FIX_PLAN.md, Phase 3).

function revalidateMilestones(projectId: string) {
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/pm-plan`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createMilestone(
  projectId: string,
  input: { name: string; type: MilestoneType; plannedDate?: string | null; ownerPersonId?: string | null }
) {
  const user = await requireModuleWrite(projectId, "MILESTONES");

  const { _max } = await prisma.milestone.aggregate({ where: { projectId }, _max: { order: true } });
  // No payment row yet — updateMilestonePayment creates it the first time a
  // payment field is set, so a milestone with no tranche carries no empty row.
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
  _projectId: string,
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
  const user = await requireModuleWrite(existing.projectId, "MILESTONES");

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
}

/** Payment %, invoice status, client sign-off, notes — creates the milestone's payment row on first edit. */
export async function updateMilestonePayment(
  milestoneId: string,
  _projectId: string,
  data: Partial<{ paymentPct: number; invoiceStatus: string; clientSignoff: string; notes: string }>
) {
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { payment: true } });
  const user = await requireModuleWrite(milestone.projectId, "MILESTONES");

  const changes = {
    ...(data.paymentPct !== undefined ? { paymentPct: data.paymentPct } : {}),
    ...(data.invoiceStatus !== undefined ? { invoiceStatus: data.invoiceStatus } : {}),
    ...(data.clientSignoff !== undefined ? { clientSignoff: data.clientSignoff } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
  };
  await prisma.milestonePayment.upsert({
    where: { milestoneId },
    create: { milestoneId, ...changes },
    update: changes,
  });

  await writeAudit({
    actor: user,
    projectId: milestone.projectId,
    action: "update",
    entityType: "MilestonePayment",
    entityId: milestone.payment?.id ?? milestoneId,
    summary: `Updated payment for milestone "${milestone.name}"`,
    diff: { before: milestone.payment, changes: data },
  });

  revalidateMilestones(milestone.projectId);
}

export async function deleteMilestone(id: string, _projectId: string) {
  const existing = await prisma.milestone.findUniqueOrThrow({ where: { id }, include: { payment: true } });
  const user = await requireModuleWrite(existing.projectId, "MILESTONES");

  // Deleting a milestone deletes its payment row (onDelete: Cascade) — never
  // silently throw away a tranche that's already been billed or paid.
  if (existing.payment && existing.payment.invoiceStatus !== "Not Invoiced") {
    throw new Error(
      `"${existing.name}" is already ${existing.payment.invoiceStatus.toLowerCase()} — set its invoice status back to Not Invoiced first if you really mean to delete it.`
    );
  }

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
