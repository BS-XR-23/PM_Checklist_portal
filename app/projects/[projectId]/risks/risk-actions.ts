"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import { RISK_LEVELS, RISK_STATUSES, RISK_TYPES } from "@/lib/constants";
import { dateClosedForStatus } from "@/lib/risks";

// Open high risks drive project health, which also shows on the Projects
// list and Portfolio.
function revalidateRisks(projectId: string) {
  revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
  revalidatePath("/projects");
  revalidatePath("/portfolio");
}

function checkOneOf(value: string | undefined, allowed: readonly string[], field: string) {
  if (value !== undefined && !allowed.includes(value)) throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
}

/** Quick-add: the description is required; everything else can be filled in later with Edit. */
export async function createRisk(
  projectId: string,
  input: { description: string; type?: string; probability?: string; impact?: string; ownerPersonId?: string | null }
) {
  const user = await requireModuleWrite(projectId, "RISK_REGISTER");
  const description = input.description.trim();
  if (!description) throw new Error("Describe the risk first.");
  checkOneOf(input.type, RISK_TYPES, "Type");
  checkOneOf(input.probability, RISK_LEVELS, "Probability");
  checkOneOf(input.impact, RISK_LEVELS, "Impact");

  const count = await prisma.riskItem.count({ where: { projectId } });
  const created = await prisma.riskItem.create({
    data: {
      projectId,
      description,
      order: count,
      dateRaised: new Date(new Date().setHours(0, 0, 0, 0)),
      ...(input.type ? { type: input.type } : {}),
      ...(input.probability ? { probability: input.probability } : {}),
      ...(input.impact ? { impact: input.impact } : {}),
      ...(input.ownerPersonId ? { ownerPersonId: input.ownerPersonId } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "RiskItem",
    entityId: created.id,
    summary: `Added ${created.type.toLowerCase()} "${description.slice(0, 60)}"`,
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
    ownerPersonId: string | null;
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
  checkOneOf(data.type, RISK_TYPES, "Type");
  checkOneOf(data.probability, RISK_LEVELS, "Probability");
  checkOneOf(data.impact, RISK_LEVELS, "Impact");
  checkOneOf(data.status, RISK_STATUSES, "Status");
  if (data.description !== undefined && !data.description.trim()) throw new Error("The description can't be empty.");
  // Closing stamps Date Closed (if empty); reopening clears it.
  const autoClosed =
    data.status !== undefined && data.dateClosed === undefined
      ? dateClosedForStatus(data.status, existing.dateClosed, new Date(new Date().setHours(0, 0, 0, 0)))
      : undefined;

  await prisma.riskItem.update({
    where: { id },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.probability !== undefined ? { probability: data.probability } : {}),
      ...(data.impact !== undefined ? { impact: data.impact } : {}),
      ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId } : {}),
      ...(data.mitigation !== undefined ? { mitigation: data.mitigation || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dateRaised !== undefined ? { dateRaised: parseDateInput(data.dateRaised) } : {}),
      ...(data.dateClosed !== undefined ? { dateClosed: parseDateInput(data.dateClosed) } : autoClosed !== undefined ? { dateClosed: autoClosed } : {}),
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
