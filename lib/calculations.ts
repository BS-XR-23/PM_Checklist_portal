// All formulas here are transcribed 1:1 from PM_Checklist_Tracker.xlsx.

const LEVEL_SCORE: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

/** Risk Register G column: Probability x Impact, Low=1/Medium=2/High=3 -> 1-9. */
export function riskScore(probability: string, impact: string): number {
  const p = LEVEL_SCORE[probability] ?? 0;
  const i = LEVEL_SCORE[impact] ?? 0;
  return p * i;
}

/** CR Log H column: Amount = Billable Man-Days x Rate. */
export function crAmount(billableManDays: number | null, rate: number | null): number | null {
  if (billableManDays == null || rate == null) return null;
  return billableManDays * rate;
}

export type CrKpis = {
  upcomingCrManDays: number; // Proposed
  workOrderCrManDays: number; // Approved + In Progress
  remainingCrManDays: number; // In Progress
};

export function computeCrKpis(
  crs: { status: string; manDaysPlanned: number | null; billableManDays: number | null }[]
): CrKpis {
  const upcomingCrManDays = crs
    .filter((c) => c.status === "Proposed")
    .reduce((sum, c) => sum + (c.manDaysPlanned ?? 0), 0);

  const workOrderCrManDays = crs
    .filter((c) => c.status === "Approved" || c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  const remainingCrManDays = crs
    .filter((c) => c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  return { upcomingCrManDays, workOrderCrManDays, remainingCrManDays };
}

export type EvmPoint = {
  weekEnding: Date;
  pctPlannedComplete: number;
  pctActualComplete: number;
  actualCost: number;
  pv: number;
  ev: number;
  cv: number;
  spi: number | null;
  cpi: number | null;
};

/**
 * Budget Tracker: PV = %Planned x ContractValue, EV = %Actual x ContractValue,
 * CV = EV-AC, SPI = EV/PV, CPI = EV/AC. >=1.0 favorable, <1.0 unfavorable.
 */
export function computeEvm(
  entries: { weekEnding: Date; pctPlannedComplete: number; pctActualComplete: number; actualCost: number }[],
  contractValue: number
): EvmPoint[] {
  return entries.map((e) => {
    const pv = contractValue * e.pctPlannedComplete;
    const ev = contractValue * e.pctActualComplete;
    const cv = ev - e.actualCost;
    const spi = pv ? ev / pv : null;
    const cpi = e.actualCost ? ev / e.actualCost : null;
    return { weekEnding: e.weekEnding, pctPlannedComplete: e.pctPlannedComplete, pctActualComplete: e.pctActualComplete, actualCost: e.actualCost, pv, ev, cv, spi, cpi };
  });
}

/** Budget Tracker B6: Man-Day Rate = Contract Value / Total Planned Man-Days. */
export function manDayRate(contractValue: number, plannedManDays: number): number {
  return plannedManDays ? contractValue / plannedManDays : 0;
}

/** Milestones & Payments H column: Tranche Amount = Total Contract Value x Payment %. */
export function trancheAmount(contractValue: number, paymentPct: number): number {
  return contractValue * paymentPct;
}

/** Forecast Date slipped past Planned Date on an incomplete item (non-blocking flag). */
export function isSlipped(
  plannedDate: Date | null,
  forecastDate: Date | null,
  status: string
): boolean {
  if (!plannedDate || !forecastDate) return false;
  if (status === "COMPLETED" || status === "NOT_APPLICABLE") return false;
  return forecastDate.getTime() > plannedDate.getTime();
}

/**
 * App-derived (not from the spreadsheet): the first stage in stageOrder that
 * still has an incomplete item, or null if everything's done. Shared by the
 * Checklist page's default-open-tab logic and the Projects list's stage
 * filter/label, so both definitions of "current stage" can't drift apart.
 */
export function currentStage(
  items: { stage: string; status: string }[],
  stageOrder: readonly string[]
): string | null {
  for (const stage of stageOrder) {
    const rows = items.filter((i) => i.stage === stage);
    if (rows.length > 0 && rows.some((r) => r.status !== "COMPLETED" && r.status !== "NOT_APPLICABLE")) return stage;
  }
  return null;
}
