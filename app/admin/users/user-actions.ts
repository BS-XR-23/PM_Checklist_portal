"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import type { Role } from "@prisma/client";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Only an Admin can manage users.");
  return user;
}

export async function createUser(email: string, name: string, role: Role): Promise<{ tempPassword: string }> {
  const admin = await requireAdmin();

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new Error(`A user with email ${normalizedEmail} already exists.`);

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const created = await prisma.user.create({ data: { email: normalizedEmail, name, passwordHash, role } });

  await writeAudit({ actor: admin, action: "create", entityType: "User", entityId: created.id, summary: `Created user ${normalizedEmail} with role ${role}` });

  revalidatePath("/admin/users");
  return { tempPassword };
}

export async function updateUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { role } });

  await writeAudit({
    actor: admin,
    action: "role_change",
    entityType: "User",
    entityId: userId,
    summary: `Changed ${existing.email}'s role from ${existing.role} to ${role}`,
  });

  revalidatePath("/admin/users");
}
