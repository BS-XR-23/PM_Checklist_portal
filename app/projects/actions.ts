"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProject } from "@/lib/create-project";
import { requireUser, writeAudit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { ProjectStatus } from "@prisma/client";

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can create projects.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required.");

  const client = String(formData.get("client") ?? "").trim();
  const contractValue = Number(formData.get("contractValue") ?? 0);
  const plannedManDays = Number(formData.get("plannedManDays") ?? 0);

  const project = await createProject({ name, client, contractValue, plannedManDays });

  await writeAudit({
    actor: user,
    projectId: project.id,
    action: "create",
    entityType: "Project",
    entityId: project.id,
    summary: `Created project "${project.name}"`,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/dashboard`);
}

export async function setProjectStatus(projectId: string, status: ProjectStatus) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can archive or unarchive a project.");
  }

  const existing = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({ where: { id: projectId }, data: { status } });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "Project",
    entityId: projectId,
    summary: `${status === "ARCHIVED" ? "Archived" : "Unarchived"} project "${existing.name}"`,
  });

  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can delete a project.");
  }

  const existing = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "Project",
    entityId: projectId,
    summary: `Deleted project "${existing.name}"`,
  });

  revalidatePath("/projects");
}

export async function restoreProject(projectId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can restore a project.");
  }

  const existing = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({ where: { id: projectId }, data: { deletedAt: null } });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "Project",
    entityId: projectId,
    summary: `Restored project "${existing.name}"`,
  });

  revalidatePath("/projects");
}
