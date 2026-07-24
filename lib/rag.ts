import { computeEvm, riskScore } from "@/lib/calculations";

export type Rag = "RED" | "AMBER" | "GREEN";

export const RAG_COLORS: Record<Rag, { bg: string; text: string; label: string }> = {
  RED: { bg: "#FF7C80", text: "#7A0000", label: "Red" },
  AMBER: { bg: "#FFD966", text: "#7A5B00", label: "Amber" },
  GREEN: { bg: "#C6E0B4", text: "#2C5F2D", label: "Green" },
};

/**
 * A concept introduced for the Program Manager portfolio view — not something
 * from the source spreadsheet. Red if SPI or CPI is below 0.9, or an open
 * high-severity risk exists; Amber if either index is 0.9-0.99; Green
 * otherwise. Adjust the thresholds here if the real ones differ.
 */
export function computeProjectRag(input: {
  contractValue: number;
  budgetEntries: { weekEnding: Date; pctPlannedComplete: number; pctActualComplete: number; actualCost: number }[];
  risks: { type: string; status: string; probability: string; impact: string }[];
}): { rag: Rag; latestSpi: number | null; latestCpi: number | null; openHighRisks: number } {
  const evm = computeEvm(input.budgetEntries, input.contractValue);
  const latest = [...evm].reverse().find((e) => e.spi != null || e.cpi != null) ?? null;

  const openHighRisks = input.risks.filter(
    (r) => r.type === "Risk" && r.status !== "Closed" && r.status !== "Mitigated" && riskScore(r.probability, r.impact) >= 6
  ).length;

  const latestSpi = latest?.spi ?? null;
  const latestCpi = latest?.cpi ?? null;

  let rag: Rag = "GREEN";
  const worst = Math.min(latestSpi ?? 1, latestCpi ?? 1);
  if (openHighRisks > 0 || worst < 0.9) rag = "RED";
  else if (worst < 1.0) rag = "AMBER";

  return { rag, latestSpi, latestCpi, openHighRisks };
}
