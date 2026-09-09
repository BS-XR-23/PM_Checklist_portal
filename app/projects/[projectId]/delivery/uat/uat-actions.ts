"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateUat(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery/uat`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createUatCase(projectId: string, input: { title: string; releaseId?: string | null }) {
  const user = await requireModuleWrite(projectId, "UAT");

  const created = await prisma.uatCase.create({
    data: { projectId, title: input.title, releaseId: input.releaseId || null },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "UatCase", entityId: created.id, summary: `Added UAT case "${input.title}"` });

  revalidateUat(projectId);
  return created;
}

export async function updateUatCase(
  id: string,
  projectId: string,
  data: Partial<{
    title: string;
    scenario: string | null;
    preconditions: string | null;
    steps: string | null;
    expectedResult: string | null;
    actualResult: string | null;
    priority: string;
    status: string;
    ownerPersonId: string | null;
    releaseId: string | null;
    executedDate: string | null;
    notes: string | null;
  }>
) {
  const existing = await prisma.uatCase.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "UAT");

  await prisma.uatCase.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.scenario !== undefined ? { scenario: data.scenario || null } : {}),
      ...(data.preconditions !== undefined ? { preconditions: data.preconditions || null } : {}),
      ...(data.steps !== undefined ? { steps: data.steps || null } : {}),
      ...(data.expectedResult !== undefined ? { expectedResult: data.expectedResult || null } : {}),
      ...(data.actualResult !== undefined ? { actualResult: data.actualResult || null } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId || null } : {}),
      ...(data.releaseId !== undefined ? { releaseId: data.releaseId || null } : {}),
      ...(data.executedDate !== undefined ? { executedDate: data.executedDate ? new Date(data.executedDate) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "UatCase",
    entityId: id,
    summary: `Updated UAT case "${existing.title}"`,
    diff: { before: existing, changes: data },
  });

  revalidateUat(existing.projectId);
}

export async function deleteUatCase(id: string, _projectId: string) {
  const existing = await prisma.uatCase.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "UAT");

  await prisma.uatCase.delete({ where: { id } });

  await writeAudit({ actor: user, projectId: existing.projectId, action: "delete", entityType: "UatCase", entityId: id, summary: `Deleted UAT case "${existing.title}"`, diff: { before: existing } });

  revalidateUat(existing.projectId);
}

export async function createUatDefect(projectId: string, input: { title: string; uatCaseId?: string | null; releaseId?: string | null }) {
  const user = await requireModuleWrite(projectId, "UAT");

  const created = await prisma.uatDefect.create({
    data: { projectId, title: input.title, uatCaseId: input.uatCaseId || null, releaseId: input.releaseId || null },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "UatDefect", entityId: created.id, summary: `Logged UAT defect "${input.title}"` });

  revalidateUat(projectId);
  return created;
}

export async function updateUatDefect(
  id: string,
  projectId: string,
  data: Partial<{
    title: string;
    description: string | null;
    severity: string;
    priority: string;
    status: string;
    ownerPersonId: string | null;
    targetFixDate: string | null;
    retestResult: string | null;
    closedDate: string | null;
    notes: string | null;
  }>
) {
  const existing = await prisma.uatDefect.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "UAT");

  await prisma.uatDefect.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.severity !== undefined ? { severity: data.severity } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId || null } : {}),
      ...(data.targetFixDate !== undefined ? { targetFixDate: data.targetFixDate ? new Date(data.targetFixDate) : null } : {}),
      ...(data.retestResult !== undefined ? { retestResult: data.retestResult || null } : {}),
      ...(data.closedDate !== undefined ? { closedDate: data.closedDate ? new Date(data.closedDate) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "UatDefect",
    entityId: id,
    summary: `Updated UAT defect "${existing.title}"`,
    diff: { before: existing, changes: data },
  });

  revalidateUat(existing.projectId);
}

export async function deleteUatDefect(id: string, _projectId: string) {
  const existing = await prisma.uatDefect.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "UAT");

  await prisma.uatDefect.delete({ where: { id } });

  await writeAudit({ actor: user, projectId: existing.projectId, action: "delete", entityType: "UatDefect", entityId: id, summary: `Deleted UAT defect "${existing.title}"`, diff: { before: existing } });

  revalidateUat(existing.projectId);
}
