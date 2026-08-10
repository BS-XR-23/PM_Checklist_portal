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

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await requireUser();

  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await bcrypt.compare(currentPassword, existing.passwordHash);
  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await writeAudit({ actor: user, action: "update", entityType: "User", entityId: user.id, summary: "Changed their own password" });
}

export async function resetUserPassword(userId: string): Promise<{ tempPassword: string }> {
  const admin = await requireAdmin();

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await writeAudit({ actor: admin, action: "update", entityType: "User", entityId: userId, summary: `Reset password for ${existing.email}` });

  revalidatePath("/admin/users");
  return { tempPassword };
}

export async function updateUserProfile(userId: string, data: Partial<{ name: string; email: string }>) {
  const admin = await requireAdmin();
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  let email: string | undefined;
  if (data.email !== undefined) {
    email = data.email.toLowerCase().trim();
    if (email !== existing.email) {
      const collision = await prisma.user.findUnique({ where: { email } });
      if (collision) throw new Error(`A user with email ${email} already exists.`);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(email !== undefined ? { email } : {}),
    },
  });

  await writeAudit({
    actor: admin,
    action: "update",
    entityType: "User",
    entityId: userId,
    summary: `Updated profile for ${existing.email}`,
    diff: { before: { name: existing.name, email: existing.email }, changes: data },
  });

  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    throw new Error("You can't deactivate your own account.");
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { isActive } });

  await writeAudit({
    actor: admin,
    action: "update",
    entityType: "User",
    entityId: userId,
    summary: `${isActive ? "Reactivated" : "Deactivated"} ${existing.email}`,
  });

  revalidatePath("/admin/users");
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
