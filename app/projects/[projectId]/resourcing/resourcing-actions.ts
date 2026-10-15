"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess, writeAudit } from "@/lib/rbac";
import { canManageEngagementsOnProject } from "@/lib/resourcing-rbac";
import { parseDateInput } from "@/lib/format";

// The roster also feeds the assignee pickers on Delivery's Tasks/Sprints tabs.
function revalidateTeam(projectId: string) {
  revalidatePath(`/projects/${projectId}/resourcing`);
  revalidatePath(`/projects/${projectId}/delivery/tasks`);
  revalidatePath(`/projects/${projectId}/delivery/sprints`);
  revalidatePath("/admin/people");
  revalidatePath("/my-engagement");
}

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

/**
 * Puts a person on this project's roster — a reference list of who works on
 * it (and the pool WBS tasks and sprint work can be assigned from). No
 * intensity/allocation: that was dropped as nobody used the numbers.
 */
export async function assignEngagement(
  projectId: string,
  input: { personId: string; roleOnProject: string; startDate: string | null; endDate: string | null; notes?: string }
) {
  const user = await requireResourcingWrite(projectId);

  const person = await prisma.person.findUniqueOrThrow({ where: { id: input.personId } });
  const already = await prisma.projectEngagement.findFirst({ where: { projectId, personId: person.id } });
  if (already) throw new Error(`${person.name} is already on this project — change their role or dates in the list instead.`);

  const startDate = parseDateInput(input.startDate);
  const endDate = parseDateInput(input.endDate);
  if (startDate && endDate && endDate < startDate) throw new Error("End date is before the start date.");

  const created = await prisma.projectEngagement.create({
    data: {
      projectId,
      personId: input.personId,
      roleOnProject: input.roleOnProject.trim() || person.title || "Team Member",
      startDate,
      endDate,
      notes: input.notes?.trim() || null,
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ProjectEngagement",
    entityId: created.id,
    summary: `Added ${person.name} to this project as ${created.roleOnProject}`,
  });

  revalidateTeam(projectId);
}

export async function updateEngagement(
  engagementId: string,
  projectId: string,
  input: Partial<{ roleOnProject: string; startDate: string | null; endDate: string | null; notes: string }>
) {
  const user = await requireResourcingWrite(projectId);

  const existing = await prisma.projectEngagement.findUniqueOrThrow({ where: { id: engagementId }, include: { person: true } });
  if (existing.projectId !== projectId) throw new Error("Engagement does not belong to this project.");

  await prisma.projectEngagement.update({
    where: { id: engagementId },
    data: {
      ...(input.roleOnProject !== undefined ? { roleOnProject: input.roleOnProject } : {}),
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

  revalidateTeam(projectId);
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

  revalidateTeam(projectId);
}
