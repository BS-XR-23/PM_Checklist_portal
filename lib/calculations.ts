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

/**
 * App-derived: fraction of checklist items actually done. NOT_APPLICABLE
 * items are excluded from both the numerator and denominator entirely —
 * out of scope, not "not done". Shared by the Dashboard's "Overall %
 * Complete" and Budget Tracker's "Sync from Checklist" so the two can never
 * disagree about what "done" means.
 */
export function checklistCompletionPct(items: { status: string }[]): number {
  const applicable = items.filter((i) => i.status !== "NOT_APPLICABLE");
  if (applicable.length === 0) return 0;
  return applicable.filter((i) => i.status === "COMPLETED").length / applicable.length;
}

/** Delivery / Weekly CPI: Planned Value = sum of a week's estimated man-days. */
export function wbsPlannedValue(tasks: { manDays: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.manDays, 0);
}

/** Delivery / Weekly CPI: Earned Value = estimated man-days weighted by % complete. */
export function wbsEarnedValue(tasks: { manDays: number; pctComplete: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.manDays * t.pctComplete, 0);
}

/** Delivery / Weekly CPI: Actual Value = real days spent, adjusted by each assignee's Competency multiplier. */
export function wbsActualValue(tasks: { actualManDays: number; competencyMultiplier: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.actualManDays * t.competencyMultiplier, 0);
}

/** EV/AV > 1 = over-estimated (took less effort than planned); < 1 = under-estimated. Null when AV is 0 — nothing logged yet. */
export function competencyCpi(ev: number, av: number): number | null {
  return av ? ev / av : null;
}

/**
 * Sprint Summary: 0/100 rule — a sprint-committed task earns its full
 * man-days once its latest tracked % complete reaches 100%, otherwise 0.
 * Deliberately a separate function, not a branch inside wbsEarnedValue()
 * above: that function's weighted-%-complete meaning must stay exactly what
 * it means everywhere it's already shown (the Weekly CPI tab), so a task
 * being committed to a sprint can never retroactively change an
 * already-reported weekly EV number.
 */
export function sprintEarnedValue(tasks: { manDays: number; pctComplete: number }[]): number {
  return tasks.reduce((sum, t) => sum + (t.pctComplete >= 1 ? t.manDays : 0), 0);
}

export type WbsWeekForBudget = {
  weekEnding: Date;
  entries: { wbsTaskId: string; manDays: number; pctComplete: number; actualManDays: number; manDayRate: number }[];
};

/**
 * Shapes a Prisma `WbsWeek.findMany({ include: { entries: { include: {
 * wbsTask, person: { include: { roleRate } } } } } })` result into
 * `budgetEntriesFromWbs`'s expected input — factored out so the four call
 * sites (Budget Tracker, Dashboard, Projects list, Portfolio) can't drift
 * out of sync with each other on how a rate gets resolved.
 */
export function toWbsWeekForBudget(
  weeks: {
    weekEnding: Date;
    entries: {
      wbsTaskId: string;
      pctComplete: number;
      actualManDays: number;
      wbsTask: { manDays: number };
      person: { roleRate: { manDayRate: number } | null } | null;
    }[];
  }[]
): WbsWeekForBudget[] {
  return weeks.map((w) => ({
    weekEnding: w.weekEnding,
    entries: w.entries.map((e) => ({
      wbsTaskId: e.wbsTaskId,
      manDays: e.wbsTask.manDays,
      pctComplete: e.pctComplete,
      actualManDays: e.actualManDays,
      manDayRate: e.person?.roleRate?.manDayRate ?? 0,
    })),
  }));
}

/**
 * Budget Tracker: derives the exact shape computeEvm() already expects, live
 * from Delivery's WBS tracking — no separate BudgetEntry data entry. `weeks`
 * must be pre-sorted ascending by weekEnding (this walks a running
 * cumulative total, so order matters).
 *
 * pctPlanned/pctActualComplete are cumulative fractions of plannedManDays —
 * built from "latest known state per task," not summed per WbsWeekEntry row,
 * so a task tracked across 3 weeks counts once, not 3x; a task untouched in
 * a given week keeps its last-recorded manDays/%, same as real cumulative
 * EVM tracking. actualCost is this week's spend only (not cumulative),
 * matching the original BudgetEntry.actualCost semantics.
 */
export function budgetEntriesFromWbs(
  weeks: WbsWeekForBudget[],
  plannedManDays: number
): { weekEnding: Date; pctPlannedComplete: number; pctActualComplete: number; actualCost: number }[] {
  const latestByTask = new Map<string, { manDays: number; pctComplete: number }>();

  return weeks.map((week) => {
    for (const e of week.entries) {
      latestByTask.set(e.wbsTaskId, { manDays: e.manDays, pctComplete: e.pctComplete });
    }
    const tracked = Array.from(latestByTask.values());
    const cumulativePlanned = tracked.reduce((sum, t) => sum + t.manDays, 0);
    const cumulativeEarned = tracked.reduce((sum, t) => sum + t.manDays * t.pctComplete, 0);
    const actualCost = week.entries.reduce((sum, e) => sum + e.actualManDays * e.manDayRate, 0);

    return {
      weekEnding: week.weekEnding,
      pctPlannedComplete: plannedManDays ? cumulativePlanned / plannedManDays : 0,
      pctActualComplete: plannedManDays ? cumulativeEarned / plannedManDays : 0,
      actualCost,
    };
  });
}

/** Actual Date slipped past Planned Date on an incomplete item (non-blocking flag). */
export function isSlipped(
  plannedDate: Date | null,
  actualDate: Date | null,
  status: string
): boolean {
  if (!plannedDate || !actualDate) return false;
  if (status === "COMPLETED" || status === "NOT_APPLICABLE") return false;
  return actualDate.getTime() > plannedDate.getTime();
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

export type ReminderBand = "OVERDUE" | "DUE_SOON" | null;

/**
 * App-derived: an incomplete item whose Planned Date has already passed
 * (OVERDUE) or falls within the next `dueSoonDays` (DUE_SOON). Deliberately
 * distinct from isSlipped() above — that flags "the actual date moved past
 * the plan" (a re-estimate signal); this flags "this was due and nothing's
 * happened" (a forgot-about-it signal), which is what actually needs to
 * proactively surface to whoever owns the item.
 */
export function reminderBand(
  plannedDate: Date | null,
  isDone: boolean,
  today: Date = new Date(),
  dueSoonDays = 7
): ReminderBand {
  if (!plannedDate || isDone) return null;
  const diffDays = Math.floor((plannedDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= dueSoonDays) return "DUE_SOON";
  return null;
}
