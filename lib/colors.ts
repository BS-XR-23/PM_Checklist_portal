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

// Dependency Tracker priority/status pills — same traffic-light idea as
// Risk severity, extended with an "Extreme" tier above High.
export const DEPENDENCY_PRIORITY_COLORS = {
  Low: { bg: "#C6E0B4", text: "#2C5F2D" },
  Medium: { bg: "#FFE699", text: "#7A5B00" },
  High: { bg: "#F4B183", text: "#8A3B00" },
  Extreme: { bg: "#FF7C80", text: "#7A0000" },
};

export const DEPENDENCY_STATUS_COLORS = {
  Due: { bg: "#FFE699", text: "#7A5B00" },
  Done: { bg: "#C6E0B4", text: "#2C5F2D" },
  Blocked: { bg: "#FF7C80", text: "#7A0000" },
};

// Reminders page — one tag color per ReminderItem source (lib/notifications.ts),
// so a mixed list of checklist/action-item/presales rows reads at a glance.
export const REMINDER_SOURCE_STYLE = {
  CHECKLIST: { bg: "#DBEAFE", text: "#1D4ED8", label: "Checklist" },
  ACTION_ITEM: { bg: "#EDE9FE", text: "#6D28D9", label: "Action Item" },
  PRESALES_OPPORTUNITY: { bg: "#FEF3C7", text: "#92400E", label: "Presales" },
  PRESALES_ACTION_ITEM: { bg: "#FEF3C7", text: "#92400E", label: "Presales Action" },
};

// Budget Tracker H9:I28 CF: <1.0 unfavorable, >=1.0 favorable — the >=1.0
// cutoff for "favorable" (green) is unchanged from that spec. Below 1.0, the
// spreadsheet's flat "unfavorable" is split into two: a value close to 1.0
// (>=0.85) is genuinely different at a glance from one that's badly off, so
// it gets its own "near" amber band rather than reading as equally alarming.
export const INDEX_BAND_COLORS = {
  favorable: { bg: "#E6F4EC", text: "#00713C", label: "On Track" },
  near: { bg: "#FEF3C7", text: "#92400E", label: "Watch" },
  unfavorable: { bg: "#FBE9E9", text: "#C00000", label: "Off Track" },
};

export function indexBand(value: number): keyof typeof INDEX_BAND_COLORS {
  if (value >= 1) return "favorable";
  if (value >= 0.85) return "near";
  return "unfavorable";
}

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

// Deterministic per-person avatar color — same name always gets the same
// color (stable across reloads/pagination), spread across a fixed palette
// rather than tied to any role/group, since People (unlike Users) isn't
// organized into role sections.
const AVATAR_PALETTE = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2", "#4F46E5", "#65A30D"];

export function avatarColorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// Same deterministic-hash approach as the avatar palette, but for freeform
// tag/category text (e.g. Risk Register's Category field) rendered as a
// pastel pill — pick a stable {bg, text} pair by name, not tied to meaning.
const TAG_PALETTE: { bg: string; text: string }[] = [
  { bg: "#EDE9FE", text: "#6D28D9" }, // violet
  { bg: "#FEF3C7", text: "#92400E" }, // amber
  { bg: "#DBEAFE", text: "#1D4ED8" }, // blue
  { bg: "#FCE7F3", text: "#9D174D" }, // pink
  { bg: "#E0E7FF", text: "#4338CA" }, // indigo
  { bg: "#D1FAE5", text: "#065F46" }, // emerald
  { bg: "#FFE4E6", text: "#9F1239" }, // rose
  { bg: "#CFFAFE", text: "#155E75" }, // cyan
];

export function tagPillStyle(s: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}
