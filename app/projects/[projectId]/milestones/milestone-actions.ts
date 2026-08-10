"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import type { ChecklistType } from "@/lib/constants";

export async function updateMilestonePayment(
  id: string,
  projectId: string,
  data: Partial<{ paymentPct: number; invoiceStatus: string; clientSignoff: string; notes: string }>
) {
  const existing = await prisma.milestonePayment.findUniqueOrThrow({
    where: { id },
    include: { checklistItem: true },
  });
  // Guessed-ID fix: authorize against the milestone's real project, not the caller's claim.
  const realProjectId = existing.checklistItem.projectId;
  const user = await requireModuleWrite(realProjectId, "MILESTONES");

  await prisma.milestonePayment.update({
    where: { id },
    data: {
      ...(data.paymentPct !== undefined ? { paymentPct: data.paymentPct } : {}),
      ...(data.invoiceStatus !== undefined ? { invoiceStatus: data.invoiceStatus } : {}),
      ...(data.clientSignoff !== undefined ? { clientSignoff: data.clientSignoff } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: realProjectId,
    action: "update",
    entityType: "MilestonePayment",
    entityId: id,
    summary: `Updated milestone "${existing.checklistItem.milestoneName ?? id}"`,
    diff: { before: existing, changes: data },
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

// milestoneName lives on ChecklistItem, not MilestonePayment — a milestone's
// "name" is really the label on the checklist item it's attached to.
export async function updateMilestoneName(checklistItemId: string, projectId: string, name: string) {
  const existing = await prisma.checklistItem.findUniqueOrThrow({ where: { id: checklistItemId } });
  const user = await requireModuleWrite(existing.projectId, "MILESTONES");

  await prisma.checklistItem.update({ where: { id: checklistItemId }, data: { milestoneName: name } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "ChecklistItem",
    entityId: checklistItemId,
    summary: `Renamed milestone "${existing.milestoneName ?? ""}" to "${name}"`,
    diff: { before: { milestoneName: existing.milestoneName }, changes: { milestoneName: name } },
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

/** Creates a new custom checklist item that's also a payment milestone, in one step. */
export async function addMilestone(projectId: string, input: { checklistType: ChecklistType; stage: string; name: string }) {
  const user = await requireModuleWrite(projectId, "MILESTONES");

  const created = await prisma.$transaction(async (tx) => {
    const { _max } = await tx.checklistItem.aggregate({
      where: { projectId, type: input.checklistType },
      _max: { order: true },
    });

    const item = await tx.checklistItem.create({
      data: {
        projectId,
        type: input.checklistType,
        order: (_max.order ?? 0) + 1,
        stage: input.stage,
        itemText: input.name,
        milestoneName: input.name,
        isCustom: true,
      },
    });

    await tx.milestonePayment.create({ data: { checklistItemId: item.id, paymentPct: 0 } });

    return item;
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ChecklistItem",
    entityId: created.id,
    summary: `Added milestone "${input.name}" to "${input.stage}"`,
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
  revalidatePath(`/projects/${projectId}/${input.checklistType === "PM" ? "pm-checklist" : "devops-checklist"}`);
}
