// NONE = "No data yet": nothing to judge health on — no started sprint, no
// client milestone, no risk logged. Shown grey instead of GREEN so a project
// that hasn't been set up yet doesn't read as "Healthy".
export type Rag = "RED" | "AMBER" | "GREEN" | "NONE";

export const RAG_COLORS: Record<Rag, { bg: string; text: string; label: string }> = {
  RED: { bg: "#FF7C80", text: "#7A0000", label: "Red" },
  AMBER: { bg: "#FFD966", text: "#7A5B00", label: "Amber" },
  GREEN: { bg: "#C6E0B4", text: "#2C5F2D", label: "Green" },
  NONE: { bg: "#E2E8F0", text: "#475569", label: "No data" },
};

/** Plain-language health label — one wording for every list, card, and export. */
export const RAG_LABELS: Record<Rag, string> = {
  RED: "Critical",
  AMBER: "At Risk",
  GREEN: "Healthy",
  NONE: "No data yet",
};

// How a project's RAG is decided lives in lib/project-health.ts
// (computeProjectHealth) — the single definition every page uses.
