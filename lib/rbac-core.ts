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
  // ADMIN/TPM/PROGRAM_MANAGER all read every project regardless of
  // membership — PROGRAM_MANAGER (Management) drills into projects
  // read-only, same blanket rule as TPM, not scoped by ProgramOversight
  // (that table is organizational bookkeeping only, never consulted here).
  if (userRole === "ADMIN" || userRole === "TPM" || userRole === "PROGRAM_MANAGER") return true;
  // PM / CLIENT / LIMITED: only via an explicit membership row
  return membership != null;
}

/** Fine-grained, per-module access. Absence of a permission row means NONE. */
export function computeModuleAccess(userRole: Role, membership: MembershipLike, module: ModuleName): AccessLevel {
  if (userRole === "ADMIN") return "WRITE";
  // Budget Tracker is Admin-only, testing-purposes-only now that real
  // budget tracking lives in a separate portal — no TPM/PM/permission path
  // can ever grant it, regardless of membership or per-user overrides.
  if (module === "BUDGET_TRACKER") return "NONE";
  if (userRole === "TPM") return "READ_FULL"; // never WRITE through the normal path — see performTpmOverride
  // PROGRAM_MANAGER (Management): read-only drill-down into every project's
  // delivery modules, except Decision Log/Action Items — those stay off
  // limits, same exclusion as Escalations/Activity (hardcoded elsewhere).
  if (userRole === "PROGRAM_MANAGER") return module === "DECISION_LOG" || module === "ACTION_ITEMS" ? "NONE" : "READ_FULL";

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
  { module: "DECISION_LOG", access: "NONE" },
  { module: "ACTION_ITEMS", access: "NONE" },
  { module: "DELIVERY", access: "NONE" },
  { module: "DEPENDENCIES", access: "NONE" },
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
  "DECISION_LOG",
  "ACTION_ITEMS",
  "DELIVERY",
  "DEPENDENCIES",
];

/**
 * Default permission set seeded for a newly-created LIMITED (Guest)
 * membership — READ_LIMITED across every real per-module grid slot,
 * BUDGET_TRACKER excluded since it's forced NONE for everyone but Admin
 * regardless of what's stored. Unlike CLIENT (locked down by default),
 * Guest starts with baseline visibility and is narrowed from there.
 */
export const DEFAULT_LIMITED_PERMISSIONS: { module: ModuleName; access: AccessLevel }[] = ALL_MODULES.map((module) => ({
  module,
  access: module === "BUDGET_TRACKER" ? "NONE" : "READ_LIMITED",
}));

export type AccessPreset = {
  key: string;
  label: string;
  description: string;
  permissions: { module: ModuleName; access: AccessLevel }[];
};

/**
 * One-click starting points for a CLIENT/LIMITED member's module grid on
 * the Team tab — still freely editable per-module afterward, this just
 * saves setting all 11 dropdowns by hand for the common cases. BUDGET_TRACKER
 * is always left NONE: computeModuleAccess forces it to NONE for everyone
 * but Admin regardless of what's stored, so setting it to anything else
 * here would be a silently-ignored no-op.
 */
export const ACCESS_PRESETS: AccessPreset[] = [
  {
    key: "standard-client",
    label: "Standard Client",
    description: "Same as a new Client's default: Dashboard/Checklists limited, Milestones full, everything else hidden.",
    permissions: DEFAULT_CLIENT_PERMISSIONS,
  },
  {
    key: "full-visibility",
    label: "Full Visibility (Read-Only)",
    description: "Read-only on every module except Budget Tracker (Admin-only regardless) — no write access anywhere.",
    permissions: ALL_MODULES.map((module) => ({ module, access: module === "BUDGET_TRACKER" ? "NONE" : "READ_FULL" })),
  },
  {
    key: "no-access",
    label: "No Access",
    description: "Clears every module back to NONE — a clean reset before reconfiguring by hand.",
    permissions: ALL_MODULES.map((module) => ({ module, access: "NONE" as AccessLevel })),
  },
];
