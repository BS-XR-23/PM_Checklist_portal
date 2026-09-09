// SQLite has no native enum support in Prisma, so these are plain strings
// at the DB layer. These types/lists are the single source of truth for
// valid values across the app.
import type { Role } from "@prisma/client";

// Display names only — the underlying Role enum values (ADMIN, TPM,
// PROGRAM_MANAGER, CLIENT, PM, LIMITED) are unchanged everywhere else in
// the app (every `role === "ADMIN"` check, the DB column, AuditLog rows).
// Renaming the enum itself would be a data migration on every existing row
// in a live, shared-with-production database — this map exists so the UI
// can show new names without that risk.
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Super Admin",
  TPM: "Admin",
  PROGRAM_MANAGER: "Management",
  CLIENT: "Client",
  PM: "PM",
  LIMITED: "Guest",
};

export type ItemStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "AT_RISK"
  | "DELAYED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export const ITEM_STATUSES: ItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "AT_RISK",
  "DELAYED",
  "BLOCKED",
  "NOT_APPLICABLE",
];

export const RISK_LEVELS = ["Low", "Medium", "High"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_TYPES = ["Risk", "Opportunity", "Issue"] as const;
export const RISK_STATUSES = ["Open", "Monitoring", "Mitigated", "Closed", "Realized", "Not Pursued"] as const;

export const INVOICE_STATUSES = ["Not Invoiced", "Invoiced", "Paid"] as const;
export const SIGNOFF_STATUSES = ["Pending", "Signed", "Acknowledged", "N/A"] as const;

export const CR_TYPES = ["Paid", "Free", "Exchange"] as const;
export const CR_SIGNOFF_STATUSES = ["Pending", "Signed", "Email Acknowledgement"] as const;
export const CR_WBS_UPDATED = ["Yes", "No"] as const;
export const CR_STATUSES = ["Proposed", "Approved", "In Progress", "Completed", "Rejected"] as const;

export const DEPENDENCY_PRIORITIES = ["Low", "Medium", "High", "Extreme"] as const;
export const DEPENDENCY_STATUSES = ["Due", "Done", "Blocked"] as const;

// Display labels for the Milestone.type / Release.type Prisma enums —
// values taken verbatim from the Delivery restructure spec's "Milestone
// types may include..." / "Release types can include..." lists.
export const MILESTONE_TYPE_LABELS: Record<string, string> = {
  PLANNING: "Planning",
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  QA: "QA",
  UAT: "UAT",
  RELEASE: "Release",
  CUSTOM: "Custom",
};
export const MILESTONE_TYPES = Object.keys(MILESTONE_TYPE_LABELS);

export const RELEASE_TYPE_LABELS: Record<string, string> = {
  INTERNAL: "Internal",
  DEVELOPMENT: "Development",
  QA: "QA",
  STAGING: "Staging",
  UAT: "UAT",
  PRODUCTION: "Production",
  HOTFIX: "Hotfix",
};
export const RELEASE_TYPES = Object.keys(RELEASE_TYPE_LABELS);

export const RELEASE_DEPLOYMENT_STATUSES = ["Planned", "In Progress", "Deployed", "Rolled Back", "Failed"] as const;
export const RELEASE_APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export const UAT_CASE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "BLOCKED"] as const;
export type UatCaseStatus = (typeof UAT_CASE_STATUSES)[number];

export const UAT_DEFECT_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const UAT_DEFECT_STATUSES = ["Open", "In Progress", "Fixed", "Retest", "Closed", "Rejected"] as const;

export const UAT_SIGNOFF_STATUSES = ["Pending", "Signed", "Rejected"] as const;

// Resourcing / engagement intensity. Stored as a 0-100 percentage so the
// overload sum-threshold below is plain arithmetic; the UI offers these as
// Low/Med/High presets plus free numeric entry.
export const INTENSITY_PRESETS = { Low: 25, Med: 50, High: 90 } as const;

// A person's combined intensity across currently-active engagements above
// this is "overloaded". Change this single constant to retune it.
export const OVERLOAD_THRESHOLD_PCT = 100;

// An individual engagement at or above this intensity counts as "high" for
// the overlapping-date-range conflict check (item 5b), independent of the
// person's total.
export const HIGH_INTENSITY_THRESHOLD_PCT = 60;
