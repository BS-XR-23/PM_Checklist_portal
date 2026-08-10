"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateDecisions(projectId: string) {
  revalidatePath(`/projects/${projectId}/decisions`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createDecision(projectId: string) {
  const user = await requireModuleWrite(projectId, "DECISION_LOG");

  const count = await prisma.decisionLogItem.count({ where: { projectId } });
  const created = await prisma.decisionLogItem.create({
    data: { projectId, decision: "New decision", order: count },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "DecisionLogItem",
    entityId: created.id,
    summary: "Added a new decision",
  });

  revalidateDecisions(projectId);
}

export async function updateDecision(
  id: string,
  projectId: string,
  data: Partial<{
    date: string | null;
    decision: string;
    rationale: string;
    decidedBy: string;
    decidedByPersonId: string | null;
    notes: string;
  }>
) {
  // Guessed-ID fix: authorize against the decision's real project.
  const existing = await prisma.decisionLogItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DECISION_LOG");

  await prisma.decisionLogItem.update({
    where: { id },
    data: {
      ...(data.date !== undefined ? { date: parseDateInput(data.date) } : {}),
      ...(data.decision !== undefined ? { decision: data.decision } : {}),
      ...(data.rationale !== undefined ? { rationale: data.rationale || null } : {}),
      ...(data.decidedBy !== undefined ? { decidedBy: data.decidedBy || null } : {}),
      ...(data.decidedByPersonId !== undefined ? { decidedByPersonId: data.decidedByPersonId } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "DecisionLogItem",
    entityId: id,
    summary: `Updated decision "${existing.decision.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateDecisions(existing.projectId);
}

export async function deleteDecision(id: string, _projectId: string) {
  const existing = await prisma.decisionLogItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DECISION_LOG");

  await prisma.decisionLogItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "DecisionLogItem",
    entityId: id,
    summary: `Deleted decision "${existing.decision.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateDecisions(existing.projectId);
}
