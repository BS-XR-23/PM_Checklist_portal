// Pure authorization logic — no DB, no Next.js, no "server-only" marker, so
// this is safe to import from a plain Node test (lib/rbac.test.ts) as well
// as from lib/rbac.ts (which re-exports everything here for app code).
import type { Role, ModuleName, AccessLevel } from "@prisma/client";

const ACCESS_RANK: Record<AccessLevel, number> = {
  NONE: 0,
  READ_LIMITED: 1,
  READ_FULL: 2,
  WRITE: 3,
};

export function meetsLevel(actual: AccessLevel, min: AccessLevel): boolean {
  return ACCESS_RANK[actual] >= ACCESS_RANK[min];
}

export type MembershipLike = {
  role: Role;
  permissions: { module: ModuleName; access: AccessLevel }[];
} | null;

/** Coarse gate: does this user get into the project's route tree at all? */
export function computeProjectAccess(userRole: Role, membership: MembershipLike): boolean {
  if (userRole === "ADMIN" || userRole === "TPM") return true;
  if (userRole === "PROGRAM_MANAGER") return false; // portfolio summary only, never project detail
  // PM / CLIENT / LIMITED: only via an explicit membership row
  return membership != null;
}

/** Fine-grained, per-module access. Absence of a permission row means NONE. */
export function computeModuleAccess(userRole: Role, membership: MembershipLike, module: ModuleName): AccessLevel {
  if (userRole === "ADMIN") return "WRITE";
  if (userRole === "TPM") return "READ_FULL"; // never WRITE through the normal path — see performTpmOverride
  if (userRole === "PROGRAM_MANAGER") return "NONE"; // no per-project module access; they use /portfolio

  if (!membership) return "NONE";
  if (membership.role === "PM") return "WRITE";

  // CLIENT / LIMITED: explicit per-module override only, secure-by-default.
  const perm = membership.permissions.find((p) => p.module === module);
  return perm?.access ?? "NONE";
}

/** Default, locked-down permission set for a newly-created CLIENT membership. */
export const DEFAULT_CLIENT_PERMISSIONS: { module: ModuleName; access: AccessLevel }[] = [
  { module: "DASHBOARD", access: "READ_LIMITED" },
  { module: "PM_CHECKLIST", access: "READ_LIMITED" },
  { module: "DEVOPS_CHECKLIST", access: "READ_LIMITED" },
  { module: "MILESTONES", access: "READ_FULL" },
  { module: "RISK_REGISTER", access: "NONE" },
  { module: "CR_LOG", access: "NONE" },
  { module: "BUDGET_TRACKER", access: "NONE" },
  { module: "PM_PLAN", access: "NONE" },
];

export const ALL_MODULES: ModuleName[] = [
  "DASHBOARD",
  "PM_CHECKLIST",
  "DEVOPS_CHECKLIST",
  "MILESTONES",
  "RISK_REGISTER",
  "CR_LOG",
  "BUDGET_TRACKER",
  "PM_PLAN",
];
