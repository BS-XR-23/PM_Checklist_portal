export type Rag = "RED" | "AMBER" | "GREEN";

export const RAG_COLORS: Record<Rag, { bg: string; text: string; label: string }> = {
  RED: { bg: "#FF7C80", text: "#7A0000", label: "Red" },
  AMBER: { bg: "#FFD966", text: "#7A5B00", label: "Amber" },
  GREEN: { bg: "#C6E0B4", text: "#2C5F2D", label: "Green" },
};

// How a project's RAG is decided lives in lib/project-health.ts
// (computeProjectHealth) — the single definition every page uses.
