"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import { CR_TYPES, CR_SIGNOFF_STATUSES, CR_WBS_UPDATED, CR_STATUSES } from "@/lib/constants";

function revalidateCrLog(projectId: string) {
  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

function checkOneOf(value: string | undefined, allowed: readonly string[], field: string) {
  if (value !== undefined && !allowed.includes(value)) throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
}

function checkManDays(value: number | null | undefined, field: string) {
  if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error(`${field} can't be negative.`);
}

/** Quick-add: a title is required; everything else can be filled in later with Edit. */
export async function createChangeRequest(projectId: string, input: { title: string; type?: string; manDaysPlanned?: number | null }) {
  const user = await requireModuleWrite(projectId, "CR_LOG");
  const title = input.title.trim();
  if (!title) throw new Error("Give the change request a title first.");
  checkOneOf(input.type, CR_TYPES, "Type");
  checkManDays(input.manDaysPlanned, "Man-days planned");

  const existing = await prisma.changeRequest.findMany({ where: { projectId }, select: { crCode: true } });
  const maxNum = existing.reduce((max, cr) => {
    const n = parseInt(cr.crCode.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const crCode = `CR-${String(maxNum + 1).padStart(3, "0")}`;

  const created = await prisma.changeRequest.create({
    data: {
      projectId,
      crCode,
      title,
      dateRaised: new Date(new Date().setHours(0, 0, 0, 0)),
      ...(input.type ? { type: input.type } : {}),
      ...(input.manDaysPlanned != null ? { manDaysPlanned: input.manDaysPlanned } : {}),
    },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "ChangeRequest", entityId: created.id, summary: `Added ${crCode} "${title.slice(0, 60)}"` });

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
  checkOneOf(data.type, CR_TYPES, "Type");
  checkOneOf(data.clientSignoff, CR_SIGNOFF_STATUSES, "Client sign-off");
  checkOneOf(data.wbsUpdated, CR_WBS_UPDATED, "WBS updated");
  checkOneOf(data.status, CR_STATUSES, "Status");
  checkManDays(data.manDaysPlanned, "Man-days planned");
  checkManDays(data.billableManDays, "Billable man-days");
  checkManDays(data.rate, "Rate");
  if (data.title !== undefined && !data.title.trim()) throw new Error("The title can't be empty.");

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
