// The one definition of project health and progress. Dashboard, Delivery
// Overview, the Projects cards, and Portfolio all call into this module, so
// a project can never read GREEN on one page and RED on another (it did:
// Dashboard computed health from Budget Tracker's dollar CPI while Delivery
// used its own story-point SPI and competency CPI).
import { checklistCompletionPct, competencyCpi, sprintTotalsFor, type SprintForBudget } from "@/lib/calculations";
import { isOpenHighThreat } from "@/lib/risks";
import { countOverdueUrgentDependencies, type DependencyLike } from "@/lib/dependencies";
import type { Rag } from "@/lib/rag";
import { isMilestoneDone, milestoneDueDate } from "@/lib/milestones";

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
  plannedPoints: number; // Σ PV across closed sprints
  earnedPoints: number; // Σ EV (0/100 rule)
  actualValue: number; // Σ competency-adjusted man-days
  /** Earned ÷ committed story points over closed sprints. Null until a sprint with committed points has closed. */
  spi: number | null;
  /**
   * Earned points ÷ competency-adjusted effort (formerly labelled "CPI" on
   * Delivery). An estimate-accuracy signal — >1 means work took less effort
   * than estimated — not a cost index, so it doesn't feed health.
   */
  effortIndex: number | null;
  scheduleVariancePts: number;
  /**
   * Live progress of sprint(s) started but not yet closed — reported on its
   * own, NOT folded into spi/effortIndex. Under the 0/100 rule a running
   * sprint has committed all its points but earned almost none until tasks
   * hit 100%, so counting it made SPI crash at every sprint start (e.g. a
   * 10/10 closed sprint plus a just-started 0/10 one read as SPI 0.50).
   */
  running: { plannedPoints: number; earnedPoints: number } | null;
  /** Cumulative SPI after each closed sprint, chronological — for sparklines/trends. */
  spiHistory: { endDate: Date; spi: number }[];
  /** Cumulative effort index after each sprint, same shape as spiHistory. */
  effortHistory: { endDate: Date; effortIndex: number }[];
};

/**
 * `sprints` must be sorted ascending by startDate (cumulative series).
 * Only CLOSED sprints feed SPI, Effort Index and the history series — their
 * frozen numbers are final. Draft sprints contribute nothing (and no
 * history point, so trend charts never plot a future date), and running
 * sprints are reported separately in `running`.
 */
export function deliveryIndices(sprints: SprintForBudget[]): DeliveryIndices {
  let plannedPoints = 0;
  let earnedPoints = 0;
  let actualValue = 0;
  const spiHistory: DeliveryIndices["spiHistory"] = [];
  const effortHistory: DeliveryIndices["effortHistory"] = [];
  let runningPlanned = 0;
  let runningEarned = 0;
  let hasRunning = false;

  for (const s of sprints) {
    const t = sprintTotalsFor(s);
    if (!s.closedAt) {
      if (s.startedAt) {
        hasRunning = true;
        runningPlanned += t.plannedValue;
        runningEarned += t.earnedValue;
      }
      continue;
    }
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
    running: hasRunning ? { plannedPoints: runningPlanned, earnedPoints: runningEarned } : null,
    spiHistory,
    effortHistory,
  };
}

/** Open Risks and Issues scoring 6–9 (lib/risks.ts) — the same count the Risk & CR tiles show. */
export function countOpenHighRisks(risks: { type: string; status: string; probability: string; impact: string }[]): number {
  return risks.filter(isOpenHighThreat).length;
}

type MilestoneDates = { status: string; plannedDate: Date | null; forecastDate?: Date | null };

/**
 * Milestones not done whose due date (forecast if re-forecast, else planned
 * — see milestoneDueDate) is before today. Same rule as summarizeMilestones'
 * overdue list, so Health and the Dashboard never disagree.
 */
export function countOverdueMilestones(milestones: MilestoneDates[], today: Date = new Date()): number {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  return milestones.filter((m) => {
    const due = milestoneDueDate({ plannedDate: m.plannedDate, forecastDate: m.forecastDate ?? null });
    return !isMilestoneDone(m) && due != null && due < startOfToday;
  }).length;
}

export type ProjectHealth = {
  rag: Rag;
  spi: number | null;
  effortIndex: number | null;
  openHighRisks: number;
  overdueMilestones: number;
  /** Human-readable reasons for a RED/AMBER rating, most severe first. Empty when GREEN or NONE. */
  reasons: string[];
};

/**
 * RED: any open high-severity risk, or SPI below SPI_RED_BELOW.
 * AMBER: SPI below SPI_AMBER_BELOW, any overdue milestone, or any High/
 * Extreme dependency past its expected date (lib/dependencies.ts).
 * GREEN: none of the above.
 * NONE ("No data yet"): none of the above AND nothing to judge — no started
 * sprint (no SPI), no client milestone, no risk logged. A project that hasn't
 * been set up yet is unknown, not healthy.
 *
 * Missing data never counts against a project — no sprints yet means no SPI,
 * which is simply not a reason, rather than a 0.00 that reads as failure.
 * Dollar CPI from Budget Tracker is deliberately not an input: that page is
 * testing-only (real budget tracking lives in a separate portal).
 */
export function computeProjectHealth(input: {
  sprints: SprintForBudget[];
  risks: { type: string; status: string; probability: string; impact: string }[];
  milestones: MilestoneDates[];
  dependencies: DependencyLike[];
  today?: Date;
}): ProjectHealth {
  const { spi, effortIndex, running } = deliveryIndices(input.sprints);
  const openHighRisks = countOpenHighRisks(input.risks);
  const overdueMilestones = countOverdueMilestones(input.milestones, input.today);

  const red: string[] = [];
  const amber: string[] = [];
  if (openHighRisks > 0) red.push(`${openHighRisks} open high risk${openHighRisks > 1 ? "s/issues" : "/issue"}`);
  if (spi != null && spi < SPI_RED_BELOW) red.push(`SPI ${spi.toFixed(2)}`);
  else if (spi != null && spi < SPI_AMBER_BELOW) amber.push(`SPI ${spi.toFixed(2)}`);
  if (overdueMilestones > 0) amber.push(`${overdueMilestones} overdue milestone${overdueMilestones > 1 ? "s" : ""}`);
  const overdueDeps = countOverdueUrgentDependencies(input.dependencies, input.today);
  if (overdueDeps > 0) amber.push(`${overdueDeps} overdue high-priority dependenc${overdueDeps > 1 ? "ies" : "y"}`);

  // A running first sprint has no SPI yet, but the project is clearly under
  // way — that counts as something to judge, same as a milestone or a risk.
  const hasSignal = spi != null || running != null || input.milestones.length > 0 || input.risks.length > 0;
  const rag: Rag = red.length ? "RED" : amber.length ? "AMBER" : hasSignal ? "GREEN" : "NONE";
  return { rag, spi, effortIndex, openHighRisks, overdueMilestones, reasons: [...red, ...amber] };
}
