"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess, writeAudit } from "@/lib/rbac";
import { canManageEngagementsOnProject } from "@/lib/resourcing-rbac";
import { parseDateInput } from "@/lib/format";

async function requireResourcingWrite(projectId: string) {
  const user = await requireUser();
  await requireProjectAccess(projectId); // 404 rather than reveal existence to an outsider
  if (!canManageEngagementsOnProject(user.role)) {
    throw new Error("Not authorized to manage this project's resourcing.");
  }
  if (user.role === "PM") {
    const membership = await prisma.projectMembership.findUnique({ where: { userId_projectId: { userId: user.id, projectId } } });
    if (!membership || membership.role !== "PM") {
      throw new Error("Not authorized to manage this project's resourcing.");
    }
  }
  return user;
}

export async function assignEngagement(
  projectId: string,
  input: { personId: string; roleOnProject: string; intensityPct: number; startDate: string | null; endDate: string | null; notes?: string }
) {
  const user = await requireResourcingWrite(projectId);

  const person = await prisma.person.findUniqueOrThrow({ where: { id: input.personId } });
  if (input.intensityPct < 0 || input.intensityPct > 100) throw new Error("Intensity must be between 0 and 100.");

  const created = await prisma.projectEngagement.create({
    data: {
      projectId,
      personId: input.personId,
      roleOnProject: input.roleOnProject.trim() || person.title || "Team Member",
      intensityPct: input.intensityPct,
      startDate: parseDateInput(input.startDate),
      endDate: parseDateInput(input.endDate),
      notes: input.notes?.trim() || null,
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ProjectEngagement",
    entityId: created.id,
    summary: `Assigned ${person.name} to this project as ${created.roleOnProject} at ${created.intensityPct}%`,
  });

  revalidatePath(`/projects/${projectId}/resourcing`);
}

export async function updateEngagement(
  engagementId: string,
  projectId: string,
  input: Partial<{ roleOnProject: string; intensityPct: number; startDate: string | null; endDate: string | null; notes: string }>
) {
  const user = await requireResourcingWrite(projectId);

  const existing = await prisma.projectEngagement.findUniqueOrThrow({ where: { id: engagementId }, include: { person: true } });
  if (existing.projectId !== projectId) throw new Error("Engagement does not belong to this project.");
  if (input.intensityPct != null && (input.intensityPct < 0 || input.intensityPct > 100)) {
    throw new Error("Intensity must be between 0 and 100.");
  }

  await prisma.projectEngagement.update({
    where: { id: engagementId },
    data: {
      ...(input.roleOnProject !== undefined ? { roleOnProject: input.roleOnProject } : {}),
      ...(input.intensityPct !== undefined ? { intensityPct: input.intensityPct } : {}),
      ...(input.startDate !== undefined ? { startDate: parseDateInput(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: parseDateInput(input.endDate) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "ProjectEngagement",
    entityId: engagementId,
    summary: `Updated ${existing.person.name}'s engagement on this project`,
  });

  revalidatePath(`/projects/${projectId}/resourcing`);
}

export async function removeEngagement(engagementId: string, projectId: string) {
  const user = await requireResourcingWrite(projectId);

  const existing = await prisma.projectEngagement.findUniqueOrThrow({ where: { id: engagementId }, include: { person: true } });
  if (existing.projectId !== projectId) throw new Error("Engagement does not belong to this project.");

  await prisma.projectEngagement.delete({ where: { id: engagementId } });

  await writeAudit({
    actor: user,
    projectId,
    action: "delete",
    entityType: "ProjectEngagement",
    entityId: engagementId,
    summary: `Removed ${existing.person.name} from this project's roster`,
  });

  revalidatePath(`/projects/${projectId}/resourcing`);
}
