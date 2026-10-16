// Pure rules shared by the Users and People admin pages, their server
// actions and the Team tab: what counts as an email, how a user's global
// role bounds their project memberships, who needs a People record, and
// which portal account a People record most likely belongs to.

import type { Role } from "@prisma/client";

/** Deliberately loose — one @, something on each side, a dot in the domain, no spaces. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Trimmed, lowercased email, or an error saying what's wrong with it. */
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!isValidEmail(email)) throw new Error(`"${value.trim()}" isn't a valid email address.`);
  return email;
}

// Project-scoped roles, least to most access. ADMIN/TPM/PROGRAM_MANAGER
// aren't here: they get every project from their global role, never from a
// membership.
const MEMBERSHIP_RANK: Partial<Record<Role, number>> = { LIMITED: 1, CLIENT: 2, PM: 3 };

export function isProjectScopedRole(role: Role): boolean {
  return MEMBERSHIP_RANK[role] !== undefined;
}

/**
 * A membership can never give more than the person's global role: a global
 * Guest can be a project Guest but not a project PM. Global Super Admin /
 * Admin / Management don't take memberships at all.
 */
export function membershipRoleAllowed(globalRole: Role, membershipRole: Role): boolean {
  const g = MEMBERSHIP_RANK[globalRole];
  const m = MEMBERSHIP_RANK[membershipRole];
  return g !== undefined && m !== undefined && m <= g;
}

/**
 * The membership role a user's memberships should carry after their global
 * role changes to `nextGlobalRole`, or null when that membership needs no
 * change. Memberships follow the global role down (PM → Guest makes every
 * project membership Guest) and are left alone otherwise.
 */
export function membershipRoleAfterGlobalChange(nextGlobalRole: Role, membershipRole: Role): Role | null {
  if (!isProjectScopedRole(nextGlobalRole)) return null; // global scope — memberships are ignored anyway
  return membershipRoleAllowed(nextGlobalRole, membershipRole) ? null : nextGlobalRole;
}

/** Staff roles own items and get staffed, so they should have a People record; clients and guests don't need one. */
export function needsPersonLink(role: Role): boolean {
  return role === "ADMIN" || role === "TPM" || role === "PROGRAM_MANAGER" || role === "PM";
}

type UserLike = { id: string; name: string; email: string };

/**
 * The unlinked portal account a People record most likely belongs to: the
 * one with the same email, else the only one with the same name. Null when
 * there's no match or the name is ambiguous — a suggestion, never applied
 * automatically.
 */
export function suggestUserForPerson<U extends UserLike>(person: { name: string; email: string | null }, unlinkedUsers: U[]): { user: U; by: "email" | "name" } | null {
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  if (person.email) {
    const byEmail = unlinkedUsers.find((u) => norm(u.email) === norm(person.email));
    if (byEmail) return { user: byEmail, by: "email" };
  }
  const byName = unlinkedUsers.filter((u) => norm(u.name) === norm(person.name));
  return byName.length === 1 ? { user: byName[0], by: "name" } : null;
}
