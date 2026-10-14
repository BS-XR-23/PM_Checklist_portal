"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

export async function updateProjectFinancials(
  projectId: string,
  data: Partial<{ contractValue: number; plannedManDays: number; plannedStoryPoints: number; crRate: number }>
) {
  // Gate per field, not per call: contractValue is a Milestones & Payments
  // input (tranche amounts), editable by anyone with MILESTONES write — a PM
  // included. The other three only exist on Budget Tracker (Admin-only), so
  // they keep that gate. Requiring BUDGET_TRACKER for contractValue too meant
  // every PM save from the Milestones tab failed.
  const { contractValue, ...budgetOnly } = data;
  const touchesBudgetOnly = Object.values(budgetOnly).some((v) => v !== undefined);
  let user = contractValue !== undefined ? await requireModuleWrite(projectId, "MILESTONES") : null;
  if (touchesBudgetOnly || !user) user = await requireModuleWrite(projectId, "BUDGET_TRACKER");

  const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({ where: { id: projectId }, data });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "Project",
    entityId: projectId,
    summary: "Updated project financials (contract value / planned story points / man-day rate input / CR rate)",
    diff: { before, changes: data },
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}
