"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";

async function requirePersonAdmin() {
  const user = await requireUser();
  if (!canManagePersonRegistry(user.role)) throw new Error("Only an Admin can manage Role Rates.");
  return user;
}

export async function createRoleRate(input: { roleName: string; manDayRate: number }) {
  const admin = await requirePersonAdmin();
  if (!input.roleName.trim()) throw new Error("Role name is required.");

  const created = await prisma.roleRate.create({
    data: { roleName: input.roleName.trim(), manDayRate: input.manDayRate },
  });

  await writeAudit({ actor: admin, action: "create", entityType: "RoleRate", entityId: created.id, summary: `Added Role Rate "${created.roleName}"` });
  revalidatePath("/admin/people");
}

export async function updateRoleRate(roleRateId: string, input: { roleName?: string; manDayRate?: number }) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.roleRate.findUniqueOrThrow({ where: { id: roleRateId } });

  await prisma.roleRate.update({
    where: { id: roleRateId },
    data: {
      ...(input.roleName !== undefined ? { roleName: input.roleName.trim() } : {}),
      ...(input.manDayRate !== undefined ? { manDayRate: input.manDayRate } : {}),
    },
  });

  await writeAudit({ actor: admin, action: "update", entityType: "RoleRate", entityId: roleRateId, summary: `Updated Role Rate "${existing.roleName}"` });
  revalidatePath("/admin/people");
}

export async function deleteRoleRate(roleRateId: string) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.roleRate.findUniqueOrThrow({ where: { id: roleRateId } });

  // Deleting doesn't touch any BudgetEntryRoleCost that already used this
  // rate — those rows snapshotted roleName/manDayRate at the time, so
  // historical actual-cost figures are unaffected (roleRateId just goes
  // null via onDelete: SetNull).
  await prisma.roleRate.delete({ where: { id: roleRateId } });

  await writeAudit({ actor: admin, action: "delete", entityType: "RoleRate", entityId: roleRateId, summary: `Deleted Role Rate "${existing.roleName}"` });
  revalidatePath("/admin/people");
}
