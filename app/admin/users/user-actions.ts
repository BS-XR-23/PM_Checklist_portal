"use server";

import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { isCurrentlyActive } from "@/lib/overload";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

// Accepts either the raw enum name ("PROGRAM_MANAGER", "Program Manager")
// or the current display label ("Management") — a CSV author reasonably
// might type either, and silently defaulting an unrecognized-but-plausible
// value to Guest would be confusing. Raw enum text is spread LAST so it
// always wins a collision — TPM's label is literally "Admin", which would
// otherwise shadow the real ADMIN enum name and silently downgrade anyone
// who typed "Admin" expecting Super Admin.
const ROLE_TEXT_LOOKUP = new Map<string, Role>([
  ...ALL_ROLES.map((r) => [ROLE_LABELS[r].toUpperCase().replace(/[\s-]+/g, "_"), r] as const),
  ...ALL_ROLES.map((r) => [r, r] as const),
]);

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

    const matchedRole = ROLE_TEXT_LOOKUP.get(row.role.toUpperCase().replace(/[\s-]+/g, "_"));
    if (row.role && !matchedRole) unmatchedRoleCount++;
    const role: Role = matchedRole ?? "LIMITED";

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

/**
 * Whether a user can be permanently removed rather than just deactivated.
 * AuditLog.actorId, EscalationItem.createdById, and PresalesProject.createdBy
 * all reference User with no cascade (Restrict) — deliberately, since those
 * are supposed to be a permanent "who did this" record. So a real delete is
 * only offered for an account with none of the three: a mistake/duplicate
 * signup, not a real contributor. Anyone else stays on Deactivate.
 */
export async function getDeletionEligibility(userId: string): Promise<{
  eligible: boolean;
  auditLogCount: number;
  escalationCount: number;
  presalesProjectCount: number;
}> {
  await requireAdmin();

  const [auditLogCount, escalationCount, presalesProjectCount] = await Promise.all([
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.escalationItem.count({ where: { createdById: userId } }),
    prisma.presalesProject.count({ where: { createdById: userId } }),
  ]);

  return {
    eligible: auditLogCount === 0 && escalationCount === 0 && presalesProjectCount === 0,
    auditLogCount,
    escalationCount,
    presalesProjectCount,
  };
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    throw new Error("You can't delete your own account.");
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // Re-check server-side rather than trusting the client's last-seen
  // eligibility result — this is irreversible, unlike deactivate.
  const eligibility = await getDeletionEligibility(userId);
  if (!eligibility.eligible) {
    throw new Error("This account has activity history and can't be permanently deleted. Deactivate it instead.");
  }

  // Written with the admin as actor before the row is gone — entityId is a
  // plain string column here, not a foreign key, so it stays valid (and
  // meaningful) after the user it names no longer exists.
  await writeAudit({ actor: admin, action: "delete", entityType: "User", entityId: userId, summary: `Deleted user ${existing.email}` });

  await prisma.user.delete({ where: { id: userId } });

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
