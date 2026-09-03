"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateDependencies(projectId: string) {
  revalidatePath(`/projects/${projectId}/dependencies`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createDependency(projectId: string) {
  const user = await requireModuleWrite(projectId, "DEPENDENCIES");

  const count = await prisma.dependencyItem.count({ where: { projectId } });
  const created = await prisma.dependencyItem.create({
    data: { projectId, description: "New dependency item", order: count },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "DependencyItem",
    entityId: created.id,
    summary: "Added a new dependency item",
  });

  revalidateDependencies(projectId);
}

export async function updateDependency(
  id: string,
  projectId: string,
  data: Partial<{
    category: string;
    description: string;
    preferredFormat: string;
    responsible: string;
    priority: string;
    expectedDate: string | null;
    status: string;
    notes: string;
  }>
) {
  // Guessed-ID fix: authorize against the dependency's real project.
  const existing = await prisma.dependencyItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DEPENDENCIES");

  await prisma.dependencyItem.update({
    where: { id },
    data: {
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.preferredFormat !== undefined ? { preferredFormat: data.preferredFormat || null } : {}),
      ...(data.responsible !== undefined ? { responsible: data.responsible || null } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.expectedDate !== undefined ? { expectedDate: parseDateInput(data.expectedDate) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "DependencyItem",
    entityId: id,
    summary: `Updated dependency "${existing.description.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateDependencies(existing.projectId);
}

export async function deleteDependency(id: string, _projectId: string) {
  const existing = await prisma.dependencyItem.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DEPENDENCIES");

  await prisma.dependencyItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "DependencyItem",
    entityId: id,
    summary: `Deleted dependency "${existing.description.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateDependencies(existing.projectId);
}
