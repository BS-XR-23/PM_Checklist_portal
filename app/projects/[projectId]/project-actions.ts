"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

export async function updateProjectFinancials(
  projectId: string,
  data: Partial<{ contractValue: number; plannedManDays: number; plannedStoryPoints: number; crRate: number }>
) {
  // This one control feeds both Milestones (tranche amounts) and Budget
  // Tracker (EVM) — require write access to both rather than picking one.
  await requireModuleWrite(projectId, "MILESTONES");
  const user = await requireModuleWrite(projectId, "BUDGET_TRACKER");

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
