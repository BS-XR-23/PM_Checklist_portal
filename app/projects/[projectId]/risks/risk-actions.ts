"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateRisks(projectId: string) {
  revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createRisk(projectId: string) {
  const user = await requireModuleWrite(projectId, "RISK_REGISTER");

  const count = await prisma.riskItem.count({ where: { projectId } });
  const created = await prisma.riskItem.create({
    data: { projectId, description: "New risk/opportunity/issue", order: count },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "RiskItem",
    entityId: created.id,
    summary: "Added a new risk/opportunity/issue",
  });

  revalidateRisks(projectId);
}

export async function updateRisk(
  id: string,
  projectId: string,
  data: Partial<{
    type: string;
    category: string;
    description: string;
    probability: string;
    impact: string;
    owner: string;
    mitigation: string;
    status: string;
    dateRaised: string | null;
    dateClosed: string | null;
    notes: string;
  }>
) {
  // Guessed-ID fix: authorize against the risk's real project.
  const existing = await prisma.riskItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "RISK_REGISTER");

  await prisma.riskItem.update({
    where: { id },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.probability !== undefined ? { probability: data.probability } : {}),
      ...(data.impact !== undefined ? { impact: data.impact } : {}),
      ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
      ...(data.mitigation !== undefined ? { mitigation: data.mitigation || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dateRaised !== undefined ? { dateRaised: parseDateInput(data.dateRaised) } : {}),
      ...(data.dateClosed !== undefined ? { dateClosed: parseDateInput(data.dateClosed) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "RiskItem",
    entityId: id,
    summary: `Updated risk "${existing.description.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateRisks(existing.projectId);
}

export async function deleteRisk(id: string, _projectId: string) {
  const existing = await prisma.riskItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "RISK_REGISTER");

  await prisma.riskItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "RiskItem",
    entityId: id,
    summary: `Deleted risk "${existing.description.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateRisks(existing.projectId);
}
