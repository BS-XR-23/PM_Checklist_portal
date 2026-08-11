"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess, writeAudit } from "@/lib/rbac";
import { canManageEngagementsOnProject } from "@/lib/resourcing-rbac";
import { parseDateInput, startOfMonthUTC, parseMonthParam } from "@/lib/format";
import { isActiveDuringMonth } from "@/lib/overload";

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

  const startDate = parseDateInput(input.startDate);
  const endDate = parseDateInput(input.endDate);
  // Seed the first month this engagement is actually relevant for — "now"
  // unless it starts later, so assigning someone starting next quarter
  // doesn't stamp an intensity on a month they haven't started yet.
  const today = new Date();
  const seedMonth = startOfMonthUTC(startDate && startDate > today ? startDate : today);

  const created = await prisma.projectEngagement.create({
    data: {
      projectId,
      personId: input.personId,
      roleOnProject: input.roleOnProject.trim() || person.title || "Team Member",
      startDate,
      endDate,
      notes: input.notes?.trim() || null,
      months: { create: { month: seedMonth, intensityPct: input.intensityPct } },
    },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ProjectEngagement",
    entityId: created.id,
    summary: `Assigned ${person.name} to this project as ${created.roleOnProject} at ${input.intensityPct}%`,
  });

  revalidatePath(`/projects/${projectId}/resourcing`);
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

  revalidatePath(`/projects/${projectId}/resourcing`);
}

/** Sets (or updates) one calendar month's intensity for an engagement — the
 * only way intensity is edited now that it varies month to month. */
export async function setEngagementMonthIntensity(engagementId: string, projectId: string, month: string, intensityPct: number) {
  const user = await requireResourcingWrite(projectId);

  const existing = await prisma.projectEngagement.findUniqueOrThrow({ where: { id: engagementId }, include: { person: true } });
  if (existing.projectId !== projectId) throw new Error("Engagement does not belong to this project.");
  if (intensityPct < 0 || intensityPct > 100) throw new Error("Intensity must be between 0 and 100.");

  const targetMonth = parseMonthParam(month);
  if (!isActiveDuringMonth({ startDate: existing.startDate, endDate: existing.endDate }, targetMonth)) {
    throw new Error("That month falls outside this engagement's Start/End range.");
  }

  await prisma.projectEngagementMonth.upsert({
    where: { engagementId_month: { engagementId, month: targetMonth } },
    create: { engagementId, month: targetMonth, intensityPct },
    update: { intensityPct },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "ProjectEngagementMonth",
    entityId: engagementId,
    summary: `Set ${existing.person.name}'s intensity for ${month} to ${intensityPct}%`,
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
