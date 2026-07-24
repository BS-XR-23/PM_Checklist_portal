"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

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
