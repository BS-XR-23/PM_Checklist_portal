// The one definition of project health and progress. Dashboard, Delivery
// Overview, the Projects cards, and Portfolio all call into this module, so
// a project can never read GREEN on one page and RED on another (it did:
// Dashboard computed health from Budget Tracker's dollar CPI while Delivery
// used its own story-point SPI and competency CPI).
import { checklistCompletionPct, competencyCpi, riskScore, sprintTotalsFor, type SprintForBudget } from "@/lib/calculations";
import type { Rag } from "@/lib/rag";

/** SPI at or above this is on schedule; below it is AMBER, and below SPI_RED_BELOW is RED. */
export const SPI_AMBER_BELOW = 1.0;
export const SPI_RED_BELOW = 0.9;

/**
 * Governance % — share of applicable checklist items completed, pooled
 * across every checklist type (N/A excluded from both sides). "How much of
 * the process has been followed."
 */
export function governancePct(items: { status: string }[]): number {
  return checklistCompletionPct(items);
}

/**
 * Delivery % — story points done out of the project's total WBS story
 * points (each task contributes storyPoints × pctComplete, same as the
 * Tasks tab's Done Points). "How much of the actual product work is done."
 * Null when the WBS has no points yet — there's nothing to measure against,
 * which is different from 0% done.
 */
export function deliveryPct(tasks: { storyPoints: number; pctComplete: number }[]): number | null {
  const total = wbsBaselinePoints(tasks);
  if (!total) return null;
  return tasks.reduce((sum, t) => sum + t.storyPoints * Math.min(t.pctComplete, 1), 0) / total;
}

/**
 * The project's planned scope in story points = the sum of every WBS task's
 * estimate. Replaces the hand-typed Project.plannedStoryPoints, which was 0
 * on every project (only editable on the Admin-only Budget Tracker), making
 * PV/EV always 0 and CPI 0.00.
 */
export function wbsBaselinePoints(tasks: { storyPoints: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.storyPoints, 0);
}

export type DeliveryIndices = {
  plannedPoints: number; // Σ PV across started/closed sprints
  earnedPoints: number; // Σ EV (0/100 rule)
  actualValue: number; // Σ competency-adjusted man-days
  /** Earned ÷ committed story points. Null until a started sprint has committed points. */
  spi: number | null;
  /**
   * Earned points ÷ competency-adjusted effort (formerly labelled "CPI" on
   * Delivery). An estimate-accuracy signal — >1 means work took less effort
   * than estimated — not a cost index, so it doesn't feed health.
   */
  effortIndex: number | null;
  scheduleVariancePts: number;
  /** Cumulative SPI after each sprint, chronological, nulls dropped — for sparklines/trends. */
  spiHistory: { endDate: Date; spi: number }[];
  /** Cumulative effort index after each sprint, same shape as spiHistory. */
  effortHistory: { endDate: Date; effortIndex: number }[];
};

/** `sprints` must be sorted ascending by startDate (cumulative series). */
export function deliveryIndices(sprints: SprintForBudget[]): DeliveryIndices {
  let plannedPoints = 0;
  let earnedPoints = 0;
  let actualValue = 0;
  const spiHistory: DeliveryIndices["spiHistory"] = [];
  const effortHistory: DeliveryIndices["effortHistory"] = [];

  for (const s of sprints) {
    const t = sprintTotalsFor(s);
    plannedPoints += t.plannedValue;
    earnedPoints += t.earnedValue;
    actualValue += t.actualValue;
    if (plannedPoints) spiHistory.push({ endDate: s.endDate, spi: earnedPoints / plannedPoints });
    const effort = competencyCpi(earnedPoints, actualValue);
    if (effort != null) effortHistory.push({ endDate: s.endDate, effortIndex: effort });
  }

  return {
    plannedPoints,
    earnedPoints,
    actualValue,
    spi: plannedPoints ? earnedPoints / plannedPoints : null,
    effortIndex: competencyCpi(earnedPoints, actualValue),
    scheduleVariancePts: earnedPoints - plannedPoints,
    spiHistory,
    effortHistory,
  };
}

export function countOpenHighRisks(risks: { type: string; status: string; probability: string; impact: string }[]): number {
  return risks.filter(
    (r) => r.type === "Risk" && r.status !== "Closed" && r.status !== "Mitigated" && riskScore(r.probability, r.impact) >= 6
  ).length;
}

/** Milestones not done whose planned date has already passed. */
export function countOverdueMilestones(
  milestones: { status: string; plannedDate: Date | null }[],
  today: Date = new Date()
): number {
  return milestones.filter(
    (m) => m.status !== "COMPLETED" && m.status !== "NOT_APPLICABLE" && m.plannedDate != null && m.plannedDate < today
  ).length;
}

export type ProjectHealth = {
  rag: Rag;
  spi: number | null;
  effortIndex: number | null;
  openHighRisks: number;
  overdueMilestones: number;
  /** Human-readable reasons for a non-GREEN rating, most severe first. Empty when GREEN. */
  reasons: string[];
};

/**
 * RED: any open high-severity risk, or SPI below SPI_RED_BELOW.
 * AMBER: SPI below SPI_AMBER_BELOW, or any overdue milestone.
 * GREEN: none of the above.
 *
 * Missing data never counts against a project — no sprints yet means no SPI,
 * which is simply not a reason, rather than a 0.00 that reads as failure.
 * Dollar CPI from Budget Tracker is deliberately not an input: that page is
 * testing-only (real budget tracking lives in a separate portal).
 */
export function computeProjectHealth(input: {
  sprints: SprintForBudget[];
  risks: { type: string; status: string; probability: string; impact: string }[];
  milestones: { status: string; plannedDate: Date | null }[];
  today?: Date;
}): ProjectHealth {
  const { spi, effortIndex } = deliveryIndices(input.sprints);
  const openHighRisks = countOpenHighRisks(input.risks);
  const overdueMilestones = countOverdueMilestones(input.milestones, input.today);

  const red: string[] = [];
  const amber: string[] = [];
  if (openHighRisks > 0) red.push(`${openHighRisks} open high risk${openHighRisks > 1 ? "s" : ""}`);
  if (spi != null && spi < SPI_RED_BELOW) red.push(`SPI ${spi.toFixed(2)}`);
  else if (spi != null && spi < SPI_AMBER_BELOW) amber.push(`SPI ${spi.toFixed(2)}`);
  if (overdueMilestones > 0) amber.push(`${overdueMilestones} overdue milestone${overdueMilestones > 1 ? "s" : ""}`);

  const rag: Rag = red.length ? "RED" : amber.length ? "AMBER" : "GREEN";
  return { rag, spi, effortIndex, openHighRisks, overdueMilestones, reasons: [...red, ...amber] };
}
