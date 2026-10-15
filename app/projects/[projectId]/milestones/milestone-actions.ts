"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import { parseDateInput } from "@/lib/format";
import { INVOICE_STATUSES, ITEM_STATUSES, MILESTONE_TYPES, SIGNOFF_STATUSES } from "@/lib/constants";
import { actualDateForStatus } from "@/lib/milestones";
import type { MilestoneType } from "@prisma/client";

// Milestones are the project's client-facing delivery commitments (MVP
// delivered, UAT complete, Go-Live, ...) and the only thing that carries a
// payment tranche, invoice status, and client sign-off. They have one home —
// the "Milestones & Payments" tab — and are gated on the MILESTONES module.
// PM Plan, Dashboard, Delivery, and Portfolio only read them.
//
// Checklist items tagged with a name are internal "checkpoints", not
// milestones: they never create or own a payment (docs/FIX_PLAN.md, Phase 3).
// "Gate" means only the PM Plan's G0-G6 stage-gate framework (Phase 4).

function revalidateMilestones(projectId: string) {
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/pm-plan`);
  revalidatePath(`/projects/${projectId}/activity`);
  // Next milestone, overdue count and payments also show on these.
  revalidatePath("/projects");
  revalidatePath("/portfolio");
}

function checkOneOf(value: string | undefined, allowed: readonly string[], field: string) {
  if (value !== undefined && !allowed.includes(value)) throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
}

/** A milestone's payment % must be 0–100%, and all of the project's together can't pass 100% of the contract. */
async function checkPaymentPct(projectId: string, milestoneId: string | null, pct: number) {
  if (!Number.isFinite(pct) || pct < 0 || pct > 1) throw new Error("Payment % must be between 0% and 100%.");
  const others = await prisma.milestonePayment.aggregate({
    where: { milestone: { projectId, ...(milestoneId ? { id: { not: milestoneId } } : {}) } },
    _sum: { paymentPct: true },
  });
  const total = (others._sum.paymentPct ?? 0) + pct;
  if (total > 1.0001) {
    throw new Error(`That would put ${Math.round(total * 100)}% of the contract on milestones. Lower another milestone's payment first — the total can't pass 100%.`);
  }
}

export async function createMilestone(
  projectId: string,
  input: { name: string; type: MilestoneType; plannedDate?: string | null; ownerPersonId?: string | null; paymentPct?: number | null }
) {
  const user = await requireModuleWrite(projectId, "MILESTONES");
  const name = input.name.trim();
  if (!name) throw new Error("Give the milestone a name first.");
  checkOneOf(input.type, MILESTONE_TYPES, "Type");
  if (input.paymentPct) await checkPaymentPct(projectId, null, input.paymentPct);

  const { _max } = await prisma.milestone.aggregate({ where: { projectId }, _max: { order: true } });
  // A payment row only when a payment % is given — otherwise
  // updateMilestonePayment creates it the first time a payment field is set.
  const created = await prisma.milestone.create({
    data: {
      projectId,
      name,
      type: input.type,
      order: (_max.order ?? 0) + 1,
      plannedDate: parseDateInput(input.plannedDate ?? null),
      ownerPersonId: input.ownerPersonId || null,
      ...(input.paymentPct ? { payment: { create: { paymentPct: input.paymentPct } } } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "Milestone",
    entityId: created.id,
    summary: `Added milestone "${name}"`,
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
  checkOneOf(data.type, MILESTONE_TYPES, "Type");
  checkOneOf(data.status, ITEM_STATUSES, "Status");
  if (data.name !== undefined && !data.name.trim()) throw new Error("The name can't be empty.");
  // Completing stamps the actual date (if empty); reopening clears it.
  const autoActual =
    data.status !== undefined && data.actualDate === undefined
      ? actualDateForStatus(data.status, existing.actualDate, new Date(new Date().setHours(0, 0, 0, 0)))
      : undefined;

  await prisma.milestone.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
      ...(data.forecastDate !== undefined ? { forecastDate: parseDateInput(data.forecastDate) } : {}),
      ...(data.actualDate !== undefined ? { actualDate: parseDateInput(data.actualDate) } : autoActual !== undefined ? { actualDate: autoActual } : {}),
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
  checkOneOf(data.invoiceStatus, INVOICE_STATUSES, "Invoice status");
  checkOneOf(data.clientSignoff, SIGNOFF_STATUSES, "Client sign-off");
  if (data.paymentPct !== undefined) await checkPaymentPct(milestone.projectId, milestoneId, data.paymentPct);

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
