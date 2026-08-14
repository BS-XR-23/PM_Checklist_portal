import type { ItemStatus } from "@/lib/constants";
import { HIGH_INTENSITY_THRESHOLD_PCT } from "@/lib/constants";

// Exact hex values taken from the conditional-formatting `dxf` rules in
// PM_Checklist_Tracker.xlsx (PM Checklist / DevOps Checklist H column).
export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; label: string }> = {
  NOT_STARTED: { bg: "#D9D9D9", text: "#3F3F3F", label: "Not Started" },
  IN_PROGRESS: { bg: "#FFE699", text: "#7A5B00", label: "In Progress" },
  COMPLETED: { bg: "#C6E0B4", text: "#2C5F2D", label: "Completed" },
  AT_RISK: { bg: "#FFD966", text: "#7A5B00", label: "At Risk" },
  DELAYED: { bg: "#F4B183", text: "#8A3B00", label: "Delayed" },
  BLOCKED: { bg: "#FF7C80", text: "#7A0000", label: "Blocked" },
  // Not from the spreadsheet — added so an item genuinely out of scope for a
  // specific project (e.g. a 3D-only step on a 2D project) can be excluded
  // from that project's completion % without disappearing from the fixed
  // template. Neutral gray, matching the "Custom" item badge's color.
  NOT_APPLICABLE: { bg: "#E2E8F0", text: "#475569", label: "Not Applicable" },
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

// Actual Date slipped past Planned Date flag (G column CF), non-blocking.
export const SLIPPED_FLAG_COLOR = "#C00000";

// Engagement intensity Low/Med/High bands — same traffic-light palette as
// risk severity, so "heavier allocation" reads the same as "higher risk"
// everywhere else in the app. The High cutoff matches
// HIGH_INTENSITY_THRESHOLD_PCT exactly, so a badge marked High here is
// always the same engagement lib/overload.ts would flag for the
// overlapping-date-range conflict check.
export const INTENSITY_BAND_COLORS = {
  low: { bg: "#C6E0B4", text: "#2C5F2D", label: "Low" },
  medium: { bg: "#FFE699", text: "#7A5B00", label: "Medium" },
  high: { bg: "#FF7C80", text: "#7A0000", label: "High" },
};

export function intensityBand(pct: number): keyof typeof INTENSITY_BAND_COLORS {
  if (pct >= HIGH_INTENSITY_THRESHOLD_PCT) return "high";
  if (pct >= 40) return "medium";
  return "low";
}
