"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";

async function requirePersonAdmin() {
  const user = await requireUser();
  if (!canManagePersonRegistry(user.role)) throw new Error("Only an Admin can manage Competencies.");
  return user;
}

export async function createCompetency(input: { level: string; multiplier: number }) {
  const admin = await requirePersonAdmin();
  if (!input.level.trim()) throw new Error("Level name is required.");

  const created = await prisma.competency.create({
    data: { level: input.level.trim(), multiplier: input.multiplier },
  });

  await writeAudit({ actor: admin, action: "create", entityType: "Competency", entityId: created.id, summary: `Added Competency "${created.level}"` });
  revalidatePath("/admin/people");
}

export async function updateCompetency(competencyId: string, input: { level?: string; multiplier?: number }) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.competency.findUniqueOrThrow({ where: { id: competencyId } });

  await prisma.competency.update({
    where: { id: competencyId },
    data: {
      ...(input.level !== undefined ? { level: input.level.trim() } : {}),
      ...(input.multiplier !== undefined ? { multiplier: input.multiplier } : {}),
    },
  });

  await writeAudit({ actor: admin, action: "update", entityType: "Competency", entityId: competencyId, summary: `Updated Competency "${existing.level}"` });
  revalidatePath("/admin/people");
}

export async function deleteCompetency(competencyId: string) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.competency.findUniqueOrThrow({ where: { id: competencyId } });

  // Deleting doesn't touch any WbsTask that already used this Competency —
  // those rows snapshotted competencyMultiplier at assignment time, so
  // historical Actual Value figures are unaffected (competencyId just goes
  // null via onDelete: SetNull).
  await prisma.competency.delete({ where: { id: competencyId } });

  await writeAudit({ actor: admin, action: "delete", entityType: "Competency", entityId: competencyId, summary: `Deleted Competency "${existing.level}"` });
  revalidatePath("/admin/people");
}
