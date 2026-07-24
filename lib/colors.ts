import type { ItemStatus } from "@/lib/constants";

// Exact hex values taken from the conditional-formatting `dxf` rules in
// PM_Checklist_Tracker.xlsx (PM Checklist / DevOps Checklist H column).
export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; label: string }> = {
  NOT_STARTED: { bg: "#D9D9D9", text: "#3F3F3F", label: "Not Started" },
  IN_PROGRESS: { bg: "#FFE699", text: "#7A5B00", label: "In Progress" },
  COMPLETED: { bg: "#C6E0B4", text: "#2C5F2D", label: "Completed" },
  AT_RISK: { bg: "#FFD966", text: "#7A5B00", label: "At Risk" },
  DELAYED: { bg: "#F4B183", text: "#8A3B00", label: "Delayed" },
  BLOCKED: { bg: "#FF7C80", text: "#7A0000", label: "Blocked" },
};

export const STATUS_ORDER: ItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "AT_RISK",
  "DELAYED",
  "BLOCKED",
];

// Risk Register `G` column CF: <=2 Low, 3-4 Medium, >=6 High.
export const RISK_SEVERITY_COLORS = {
  low: { bg: "#C6E0B4", text: "#2C5F2D", label: "Low" },
  medium: { bg: "#FFE699", text: "#7A5B00", label: "Medium" },
  high: { bg: "#FF7C80", text: "#7A0000", label: "High" },
};

export function riskScoreSeverity(score: number): keyof typeof RISK_SEVERITY_COLORS {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

// Budget Tracker H9:I28 CF: <1.0 unfavorable, >=1.0 favorable.
export const INDEX_FAVORABLE_COLOR = "#00713C";
export const INDEX_UNFAVORABLE_COLOR = "#C00000";

// Forecast Date slipped past Planned Date flag (G column CF), non-blocking.
export const SLIPPED_FLAG_COLOR = "#C00000";
