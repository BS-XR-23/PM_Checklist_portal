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

export type EvmPoint = {
  weekEnding: Date;
  pctPlannedComplete: number;
  pctActualComplete: number;
  actualCost: number; // cumulative to this point
  sprintActualCost: number; // this period's own spend (= actualCost when not supplied)
  pv: number;
  ev: number;
  /** EV - AC: gross margin earned so far, in money. */
  cv: number;
  spi: number | null;
  /** (EV - AC) / EV — share of earned contract value left after cost. Null until something is earned. */
  margin: number | null;
};

/**
 * Budget Tracker: PV = %Planned x ContractValue, EV = %Actual x ContractValue,
 * SPI = EV/PV, and margin = (EV - AC) / EV.
 *
 * There is deliberately no dollar CPI (EV/AC). EV is in contract PRICE
 * (contract value per story point) while AC is role-rate COST, so EV/AC
 * measured margin, not cost efficiency — any profitable project read as
 * "CPI 6.3". It's reported as what it is: gross margin on earned work.
 * Effort efficiency is Delivery's Effort Index.
 */
export function computeEvm(
  entries: { weekEnding: Date; pctPlannedComplete: number; pctActualComplete: number; actualCost: number; sprintActualCost?: number }[],
  contractValue: number
): EvmPoint[] {
  return entries.map((e) => {
    const pv = contractValue * e.pctPlannedComplete;
    const ev = contractValue * e.pctActualComplete;
    const cv = ev - e.actualCost;
    const spi = pv ? ev / pv : null;
    const margin = ev ? cv / ev : null;
    return {
      weekEnding: e.weekEnding,
      pctPlannedComplete: e.pctPlannedComplete,
      pctActualComplete: e.pctActualComplete,
      actualCost: e.actualCost,
      sprintActualCost: e.sprintActualCost ?? e.actualCost,
      pv,
      ev,
      cv,
      spi,
      margin,
    };
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
 * Does this checklist item count toward completion %, current stage, and
 * overdue reminders? Not if it's NOT_APPLICABLE (out of scope), and not if
 * it's a recurring cadence activity (weekly report, monthly retro, ...) —
 * those are never "done", so counting them kept every project's current
 * stage stuck on the first stage that held one. Every completion-style
 * calculation goes through this one predicate.
 */
export function isTrackedChecklistItem(i: { status: string; isRecurring?: boolean }): boolean {
  return i.status !== "NOT_APPLICABLE" && !i.isRecurring;
}

/**
 * App-derived: fraction of tracked checklist items actually done (see
 * isTrackedChecklistItem — N/A and recurring items are excluded from both
 * the numerator and the denominator). Shared by every Governance % on the
 * Dashboard, Projects, and Portfolio so they can never disagree.
 */
export function checklistCompletionPct(items: { status: string; isRecurring?: boolean }[]): number {
  const applicable = items.filter(isTrackedChecklistItem);
  if (applicable.length === 0) return 0;
  return applicable.filter((i) => i.status === "COMPLETED").length / applicable.length;
}

/** Sprint Summary: Planned Value = sum of a sprint's committed tasks' estimated story points. */
export function wbsPlannedValue(tasks: { points: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.points, 0);
}

/** Sprint Summary: Actual Value = real days spent, adjusted by each assignee's Competency multiplier. */
export function wbsActualValue(tasks: { actualManDays: number; competencyMultiplier: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.actualManDays * t.competencyMultiplier, 0);
}

/** EV/AV > 1 = over-estimated (took less effort than planned); < 1 = under-estimated. Null when AV is 0 — nothing logged yet. */
export function competencyCpi(ev: number, av: number): number | null {
  return av ? ev / av : null;
}

/**
 * Sprint Summary: 0/100 rule — a sprint-committed task earns its full
 * story points once its latest tracked % complete reaches 100%, otherwise
 * 0. This is Delivery's only Earned Value calculation — progress is
 * tracked directly on each WbsTask (no weekly checkpoint rows), feeding
 * this function, not a competing calculation of its own.
 */
export function sprintEarnedValue(tasks: { points: number; pctComplete: number }[]): number {
  return tasks.reduce((sum, t) => sum + (t.pctComplete >= 1 ? t.points : 0), 0);
}

/**
 * Actual effort is manually typed in as hours (e.g. read off Jira), not
 * man-days directly — this is the single conversion point, shared by
 * Sprint's live/frozen Actual Value and Budget Tracker's role-breakdown,
 * so it can't drift between the two.
 */
export const HOURS_PER_MAN_DAY = 8;
export function manDaysFromHours(hours: number): number {
  return hours / HOURS_PER_MAN_DAY;
}

/**
 * actualHours is lifetime-cumulative on WbsTask (the Task tab always shows
 * it in full) — a sprint's own Actual Value/cost must only count hours
 * logged *since* the task joined its current sprint, or a task moved
 * mid-flight would bring its whole history with it and the new sprint's AV
 * would jump the instant it landed. sprintEntryHours is the actualHours
 * baseline snapshotted at that commit (see assignTaskToSprint in
 * delivery-actions.ts). Clamped at 0: a PM correcting a typo downward in
 * actualHours shouldn't produce a negative "hours this sprint".
 */
export function sprintOwnHours(actualHours: number, sprintEntryHours: number): number {
  return Math.max(0, actualHours - sprintEntryHours);
}

/**
 * One task's frozen contribution to a specific sprint — the shape used for
 * both `Sprint.departedTaskSnapshot` (a task detached from this sprint
 * while it was still open) and `Sprint.frozenTaskSnapshot` (every task's
 * final contribution once the sprint closes, live ones and departed ones
 * alike — see closeSprint()). sprintOwnHours/competencyMultiplier/
 * manDayRate/roleName are snapshotted at the moment of capture so a later
 * rate change or reassignment can never retroactively rewrite what a
 * departed or closed sprint already reported.
 */
export type SprintTaskContribution = {
  taskId: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
  sprintOwnHours: number;
  competencyMultiplier: number;
  manDayRate: number;
  roleName: string | null;
};

/** Builds a contribution entry from a *live* task still committed to the sprint in question. */
export function liveSprintContribution(t: {
  id: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
  actualHours: number;
  sprintEntryHours: number;
  competencyMultiplier: number;
  person?: { roleRate?: { manDayRate: number; roleName: string } | null } | null;
}): SprintTaskContribution {
  return {
    taskId: t.id,
    wbsNumber: t.wbsNumber,
    title: t.title,
    storyPoints: t.storyPoints,
    pctComplete: t.pctComplete,
    sprintOwnHours: sprintOwnHours(t.actualHours, t.sprintEntryHours),
    competencyMultiplier: t.competencyMultiplier,
    manDayRate: t.person?.roleRate?.manDayRate ?? 0,
    roleName: t.person?.roleRate?.roleName ?? null,
  };
}

/**
 * Tolerant JSON -> SprintTaskContribution[] parse for departedTaskSnapshot/
 * frozenTaskSnapshot — both are Json columns, and frozenTaskSnapshot in
 * particular may pre-date this shape (rows closed before sprintOwnHours/
 * manDayRate/roleName existed). Missing fields default to 0/null rather
 * than throwing, so an old closed sprint keeps rendering instead of
 * crashing the page.
 */
export function parseSprintContributions(value: unknown): SprintTaskContribution[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const r = raw as Partial<SprintTaskContribution> & Record<string, unknown>;
    return {
      taskId: String(r.taskId ?? ""),
      wbsNumber: String(r.wbsNumber ?? ""),
      title: String(r.title ?? ""),
      storyPoints: Number(r.storyPoints ?? 0),
      pctComplete: Number(r.pctComplete ?? 0),
      sprintOwnHours: Number(r.sprintOwnHours ?? 0),
      competencyMultiplier: Number(r.competencyMultiplier ?? 1),
      manDayRate: Number(r.manDayRate ?? 0),
      roleName: typeof r.roleName === "string" ? r.roleName : null,
    };
  });
}

/**
 * PV/EV/AV/cost from a unified list of contribution entries — used
 * identically whether the entries are all-live (an open sprint with no
 * departures, the common case), all-frozen (a closed sprint), or a mix of
 * live + departedTaskSnapshot (an open sprint that's lost a task mid-
 * flight). One function so those three call sites (Sprint page, Budget
 * Tracker, closeSprint) can't compute this differently from each other.
 */
export function sprintTotalsFromContributions(entries: SprintTaskContribution[]): {
  plannedValue: number;
  earnedValue: number;
  actualValue: number;
  actualCost: number;
} {
  const plannedValue = wbsPlannedValue(entries.map((e) => ({ points: e.storyPoints })));
  const earnedValue = sprintEarnedValue(entries.map((e) => ({ points: e.storyPoints, pctComplete: e.pctComplete })));
  const actualValue = wbsActualValue(
    entries.map((e) => ({ actualManDays: manDaysFromHours(e.sprintOwnHours), competencyMultiplier: e.competencyMultiplier }))
  );
  const actualCost = entries.reduce((sum, e) => sum + manDaysFromHours(e.sprintOwnHours) * e.manDayRate, 0);
  return { plannedValue, earnedValue, actualValue, actualCost };
}

export type RoleBreakdownEntry = { roleName: string; manDaysEquivalent: number; manDayRate: number; cost: number };

/** Budget Tracker's per-role cost table, from the same unified contribution list as sprintTotalsFromContributions. */
export function roleBreakdownFromContributions(entries: SprintTaskContribution[]): RoleBreakdownEntry[] {
  const groups = new Map<string, RoleBreakdownEntry>();
  for (const e of entries) {
    const roleName = e.roleName ?? "Unassigned / No Rate Role";
    const manDaysEquivalent = manDaysFromHours(e.sprintOwnHours);
    const existing = groups.get(roleName) ?? { roleName, manDaysEquivalent: 0, manDayRate: e.manDayRate, cost: 0 };
    existing.manDaysEquivalent += manDaysEquivalent;
    existing.cost += manDaysEquivalent * e.manDayRate;
    groups.set(roleName, existing);
  }
  return Array.from(groups.values()).filter((g) => g.manDaysEquivalent > 0);
}

export type SprintForBudget = {
  endDate: Date;
  closedAt: Date | null;
  startedAt: Date | null;
  frozenPlannedPoints: number | null;
  frozenEarnedPoints: number | null;
  frozenActualValue: number | null;
  /** Parsed frozenTaskSnapshot — only meaningful (and only read) when closedAt is set. */
  frozenEntries: SprintTaskContribution[];
  /** Live tasks still committed to this sprint right now. */
  liveEntries: SprintTaskContribution[];
  /** Tasks detached from this sprint while it was open — parsed departedTaskSnapshot. */
  departedEntries: SprintTaskContribution[];
};

/**
 * Shapes a Prisma `Sprint.findMany({ include: { tasks: { include: {
 * person: { include: { roleRate } } } } } })` result into
 * `budgetEntriesFromSprints`'s expected input — factored out so the four
 * call sites (Budget Tracker, Dashboard, Projects list, Portfolio) can't
 * drift out of sync with each other on how a rate gets resolved.
 */
export function toSprintsForBudget(
  sprints: {
    endDate: Date;
    closedAt: Date | null;
    startedAt: Date | null;
    frozenPlannedPoints: number | null;
    frozenEarnedPoints: number | null;
    frozenActualValue: number | null;
    frozenTaskSnapshot: unknown;
    departedTaskSnapshot: unknown;
    tasks: {
      id: string;
      wbsNumber: string;
      title: string;
      storyPoints: number;
      pctComplete: number;
      actualHours: number;
      sprintEntryHours: number;
      competencyMultiplier: number;
      person: { roleRate: { manDayRate: number; roleName: string } | null } | null;
    }[];
  }[]
): SprintForBudget[] {
  return sprints.map((s) => ({
    endDate: s.endDate,
    closedAt: s.closedAt,
    startedAt: s.startedAt,
    frozenPlannedPoints: s.frozenPlannedPoints,
    frozenEarnedPoints: s.frozenEarnedPoints,
    frozenActualValue: s.frozenActualValue,
    frozenEntries: parseSprintContributions(s.frozenTaskSnapshot),
    liveEntries: s.tasks.map(liveSprintContribution),
    departedEntries: parseSprintContributions(s.departedTaskSnapshot),
  }));
}

/**
 * One sprint's own PV/EV/AV/cost, resolved by lifecycle state — the single
 * place that decides which numbers a sprint reports. Closed sprints read
 * their permanent frozen* snapshot (PV/EV/AV) and frozenEntries (cost); a
 * Draft sprint (never started) reports all zeros, since nothing has been
 * planned-value committed yet; an open sprint computes live from its
 * liveEntries + departedEntries (a task detached from it while open still
 * counts — see Sprint.departedTaskSnapshot), the same union closeSprint()
 * itself freezes. Shared by budgetEntriesFromSprints (Budget Tracker) and
 * lib/project-health.ts (Dashboard/Delivery/Projects/Portfolio), so every
 * page agrees on what a sprint contributed.
 */
export function sprintTotalsFor(s: SprintForBudget): {
  plannedValue: number;
  earnedValue: number;
  actualValue: number;
  actualCost: number;
} {
  if (s.closedAt) {
    const { actualCost } = sprintTotalsFromContributions(s.frozenEntries);
    return {
      plannedValue: s.frozenPlannedPoints ?? 0,
      earnedValue: s.frozenEarnedPoints ?? 0,
      actualValue: s.frozenActualValue ?? 0,
      actualCost,
    };
  }
  if (!s.startedAt) return { plannedValue: 0, earnedValue: 0, actualValue: 0, actualCost: 0 };
  return sprintTotalsFromContributions([...s.liveEntries, ...s.departedEntries]);
}

/** Hours logged by assignees with no Role Rate — they cost $0 in AC, so they're surfaced instead of silently dropped. */
function uncostedHoursOf(entries: SprintTaskContribution[]): number {
  return entries.reduce((sum, e) => sum + (e.manDayRate > 0 ? 0 : e.sprintOwnHours), 0);
}

function sprintCostEntries(s: SprintForBudget): SprintTaskContribution[] {
  if (s.closedAt) return s.frozenEntries;
  if (!s.startedAt) return [];
  return [...s.liveEntries, ...s.departedEntries];
}

/**
 * Budget Tracker: derives the exact shape computeEvm() already expects, live
 * from Delivery's Sprint tracking — no separate BudgetEntry data entry.
 * `sprints` must be pre-sorted ascending by startDate (this walks running
 * cumulative totals, so order matters).
 *
 * One data point per CLOSED sprint — the same closed-sprints-only rule as
 * Delivery's SPI (lib/project-health.ts#deliveryIndices), so the two pages
 * can't disagree. A running sprint commits all its points on day one but
 * earns ~none until tasks hit 100% (0/100 rule), which used to halve SPI at
 * every sprint start; it's reported separately by runningSprintBudget().
 * Draft sprints contribute nothing and get no (future-dated) point.
 *
 * `baselinePoints` is the project's total WBS story points (see
 * wbsBaselinePoints in lib/project-health.ts) — the denominator that turns
 * cumulative earned/planned points into the % of the whole job done.
 *
 * Every series is cumulative — PV, EV, and actualCost alike — so CV and
 * margin compare like with like. sprintActualCost is the sprint's own spend
 * for the per-sprint role breakdown.
 */
export function budgetEntriesFromSprints(
  sprints: SprintForBudget[],
  baselinePoints: number
): { weekEnding: Date; pctPlannedComplete: number; pctActualComplete: number; actualCost: number; sprintActualCost: number; uncostedHours: number }[] {
  let cumulativePlanned = 0;
  let cumulativeEarned = 0;
  let cumulativeCost = 0;

  return sprints
    .filter((s) => s.closedAt)
    .map((s) => {
      const totals = sprintTotalsFor(s);
      cumulativePlanned += totals.plannedValue;
      cumulativeEarned += totals.earnedValue;
      cumulativeCost += totals.actualCost;

      return {
        weekEnding: s.endDate,
        pctPlannedComplete: baselinePoints ? cumulativePlanned / baselinePoints : 0,
        pctActualComplete: baselinePoints ? cumulativeEarned / baselinePoints : 0,
        actualCost: cumulativeCost,
        sprintActualCost: totals.actualCost,
        uncostedHours: uncostedHoursOf(sprintCostEntries(s)),
      };
    });
}

/**
 * Live totals of the sprint(s) started but not yet closed — shown on
 * Budget Tracker as "in progress, not in the totals yet". Null when nothing
 * is running.
 */
export function runningSprintBudget(
  sprints: SprintForBudget[],
  contractValue: number,
  baselinePoints: number
): { plannedValue: number; earnedValue: number; actualCost: number; committedPoints: number; earnedPoints: number; uncostedHours: number } | null {
  const running = sprints.filter((s) => s.startedAt && !s.closedAt);
  if (!running.length) return null;
  let committedPoints = 0;
  let earnedPoints = 0;
  let actualCost = 0;
  let uncostedHours = 0;
  for (const s of running) {
    const t = sprintTotalsFor(s);
    committedPoints += t.plannedValue;
    earnedPoints += t.earnedValue;
    actualCost += t.actualCost;
    uncostedHours += uncostedHoursOf(sprintCostEntries(s));
  }
  const perPoint = baselinePoints ? contractValue / baselinePoints : 0;
  return { plannedValue: committedPoints * perPoint, earnedValue: earnedPoints * perPoint, actualCost, committedPoints, earnedPoints, uncostedHours };
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
  items: { stage: string; status: string; isRecurring?: boolean }[],
  stageOrder: readonly string[]
): string | null {
  for (const stage of stageOrder) {
    const rows = items.filter((i) => i.stage === stage && isTrackedChecklistItem(i));
    if (rows.some((r) => r.status !== "COMPLETED")) return stage;
  }
  return null;
}

// The display label every caller falls back to when currentStage() returns
// null (every stage done) — one constant so it can't drift the way it once
// did ("Complete" on the Dashboard and the old Projects list, "Completed" on
// Portfolio — same meaning, different strings, so a project could show as
// "done" on one page and not match a "Completed" filter on another).
export const COMPLETED_STAGE_LABEL = "Completed";

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
