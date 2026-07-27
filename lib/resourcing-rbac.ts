// Person/ProjectEngagement don't fit the ModuleName/AccessLevel system used
// by the 8 per-project data modules (that's per-module read/write tiers for
// CLIENT/LIMITED overrides). Resourcing follows the same ad hoc role-check
// pattern already used for the Team and Escalations tabs instead.
import type { Role } from "@prisma/client";

/** Can this role see the Person registry / any project's engagement roster at all? */
export function canViewResourcing(role: Role): boolean {
  return role === "ADMIN" || role === "TPM" || role === "PM";
}

/** Admin owns the canonical Person registry (name/title/contact/linked account). */
export function canManagePersonRegistry(role: Role): boolean {
  return role === "ADMIN";
}

/** Admin anywhere; PM can assign EXISTING people to their own project only (checked by membership at the call site). */
export function canManageEngagementsOnProject(role: Role): boolean {
  return role === "ADMIN" || role === "PM";
}

/** TPM/Admin see everyone; PM sees only people engaged on their own project(s). Client/Program Manager/Limited: none. */
export function canViewPortfolioOverload(role: Role): boolean {
  return role === "ADMIN" || role === "TPM";
}
