// SQLite has no native enum support in Prisma, so these are plain strings
// at the DB layer. These types/lists are the single source of truth for
// valid values across the app.

export type ChecklistType = "PM" | "DEVOPS";

export type ItemStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "AT_RISK"
  | "DELAYED"
  | "BLOCKED";

export const ITEM_STATUSES: ItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "AT_RISK",
  "DELAYED",
  "BLOCKED",
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
