"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only an Admin can manage program oversight.");
  return user;
}

/**
 * Organizational bookkeeping only — never consulted by rbac-core.ts, so
 * adding/removing a row here can't widen or narrow what a PROGRAM_MANAGER
 * can actually open (still portfolio-only, per computeProjectAccess).
 */
export async function addProgramOversight(programManagerId: string, projectId: string) {
  const admin = await requireAdmin();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: programManagerId } });
  if (target.role !== "PROGRAM_MANAGER") {
    throw new Error("Oversight mapping only applies to a PROGRAM_MANAGER account.");
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  await prisma.programOversight.upsert({
    where: { programManagerId_projectId: { programManagerId, projectId } },
    create: { programManagerId, projectId },
    update: {},
  });

  await writeAudit({
    actor: admin,
    projectId,
    action: "create",
    entityType: "ProgramOversight",
    entityId: programManagerId,
    summary: `Added "${project.name}" to ${target.email}'s oversight list`,
  });

  revalidatePath(`/admin/users/${programManagerId}/access`);
}

export async function removeProgramOversight(oversightId: string, programManagerId: string) {
  const admin = await requireAdmin();

  const existing = await prisma.programOversight.findUniqueOrThrow({ where: { id: oversightId }, include: { project: true } });
  if (existing.programManagerId !== programManagerId) throw new Error("Oversight row does not belong to this user.");

  await prisma.programOversight.delete({ where: { id: oversightId } });

  await writeAudit({
    actor: admin,
    projectId: existing.projectId,
    action: "delete",
    entityType: "ProgramOversight",
    entityId: programManagerId,
    summary: `Removed "${existing.project.name}" from oversight list`,
  });

  revalidatePath(`/admin/users/${programManagerId}/access`);
}
