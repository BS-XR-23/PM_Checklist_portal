"use server";

import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { isCurrentlyActive } from "@/lib/overload";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

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

type ImportUserRow = { name: string; email: string; role: string };

const USER_IMPORT_HEADER_ALIASES: Record<string, keyof ImportUserRow> = {
  name: "name",
  "full name": "name",
  email: "email",
  "email address": "email",
  role: "role",
  "user role": "role",
};

function parseUserImportRows(buffer: ArrayBuffer): ImportUserRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return raw
    .map((rawRow) => {
      const row: Partial<ImportUserRow> = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const field = USER_IMPORT_HEADER_ALIASES[key.trim().toLowerCase()];
        if (field) row[field] = String(value).trim();
      }
      return { name: row.name ?? "", email: row.email ?? "", role: row.role ?? "" };
    })
    .filter((r) => r.name !== "" && r.email !== "");
}

/**
 * CSV/XLSX bulk import, same shape as People's importPeopleCsv. Unlike
 * People, every row here mints a real login (temp password + role), so this
 * only ever creates — never updates an existing email — and the caller must
 * be shown every generated temp password once, since (like createUser) it's
 * never retrievable again afterward.
 */
export async function importUsersCsv(formData: FormData): Promise<{
  created: { email: string; tempPassword: string }[];
  skippedDuplicateCount: number;
  unmatchedRoleCount: number;
}> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const buffer = await file.arrayBuffer();
  const rows = parseUserImportRows(buffer);
  if (rows.length === 0) throw new Error("No rows found — check the file has Name and Email columns.");

  const existingUsers = await prisma.user.findMany({ select: { email: true } });
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  const seenEmailsInBatch = new Set<string>();

  const created: { email: string; tempPassword: string }[] = [];
  let skippedDuplicateCount = 0;
  let unmatchedRoleCount = 0;

  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (existingEmails.has(email) || seenEmailsInBatch.has(email)) {
      skippedDuplicateCount++;
      continue;
    }
    seenEmailsInBatch.add(email);

    const roleKey = row.role.toUpperCase().replace(/[\s-]+/g, "_") as Role;
    const roleMatched = ALL_ROLES.includes(roleKey);
    if (row.role && !roleMatched) unmatchedRoleCount++;
    const role: Role = roleMatched ? roleKey : "LIMITED";

    const tempPassword = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.create({ data: { email, name: row.name, passwordHash, role } });
    created.push({ email, tempPassword });
  }

  if (created.length > 0) {
    await writeAudit({
      actor: admin,
      action: "create",
      entityType: "User",
      entityId: "bulk-import",
      summary: `Imported ${created.length} users from a file`,
    });
  }
  revalidatePath("/admin/users");
  return { created, skippedDuplicateCount, unmatchedRoleCount };
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

/**
 * Read-only preview for the "Deactivate account" confirmation — deactivating
 * only flips isActive (blocks login immediately), it never touches project
 * memberships, staffing engagements, or item ownership. This just surfaces
 * what will be silently left behind so an Admin can go clean it up manually
 * instead of finding out later.
 */
export async function getDeactivationImpact(userId: string): Promise<{
  membershipCount: number;
  personLinked: boolean;
  activeEngagementCount: number;
  openOwnedItemCount: number;
}> {
  await requireAdmin();

  const [membershipCount, person] = await Promise.all([
    prisma.projectMembership.count({ where: { userId } }),
    prisma.person.findUnique({ where: { userId }, include: { engagements: true } }),
  ]);

  if (!person) {
    return { membershipCount, personLinked: false, activeEngagementCount: 0, openOwnedItemCount: 0 };
  }

  const activeEngagementCount = person.engagements.filter((e) => isCurrentlyActive(e)).length;

  const [openChecklistCount, openRiskCount, openActionCount] = await Promise.all([
    prisma.checklistItem.count({ where: { ownerPersonId: person.id, status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] } } }),
    prisma.riskItem.count({ where: { ownerPersonId: person.id, status: { notIn: ["Closed", "Mitigated"] } } }),
    prisma.actionItem.count({ where: { ownerPersonId: person.id, status: "Open" } }),
  ]);

  return {
    membershipCount,
    personLinked: true,
    activeEngagementCount,
    openOwnedItemCount: openChecklistCount + openRiskCount + openActionCount,
  };
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
