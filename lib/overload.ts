// Pure, DB-free resourcing math — safe to unit test directly (lib/overload.test.ts),
// same shape as lib/rbac-core.ts. Two independent signals, matching the spec:
//   1. total combined intensity across CURRENTLY-ACTIVE engagements > threshold
//   2. two-or-more HIGH-intensity engagements whose date ranges overlap,
//      even if the total doesn't cross the threshold (the "same Lead Engineer
//      needed hard by two projects in the same sprint" case)
import { HIGH_INTENSITY_THRESHOLD_PCT, OVERLOAD_THRESHOLD_PCT } from "./constants";

export type EngagementLike = {
  id: string;
  projectId: string;
  projectName: string;
  roleOnProject: string;
  intensityPct: number;
  startDate: Date | null;
  endDate: Date | null;
};

/** No Project.status concept exists — "active" means today falls within the engagement's own date range. Open-ended bounds count as ongoing. */
export function isCurrentlyActive(e: Pick<EngagementLike, "startDate" | "endDate">, today: Date = new Date()): boolean {
  if (e.startDate && today < e.startDate) return false;
  if (e.endDate && today > e.endDate) return false;
  return true;
}

/** Whether an engagement's Start/End range overlaps a given calendar month at
 * all — not just whether the 1st of that month is in bounds. An engagement
 * starting mid-month (e.g. Aug 9) still overlaps August, so its intensity
 * should be settable for August; isCurrentlyActive(e, startOfMonthUTC(...))
 * would wrongly say no since Aug 1 precedes Aug 9. `targetMonth` must be
 * normalized to the 1st of its month (as startOfMonthUTC/parseMonthParam do). */
export function isActiveDuringMonth(e: Pick<EngagementLike, "startDate" | "endDate">, targetMonth: Date): boolean {
  const monthEnd = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  if (e.startDate && e.startDate > monthEnd) return false;
  if (e.endDate && e.endDate < targetMonth) return false;
  return true;
}

export type PersonLoad = {
  totalActivePct: number;
  isOverloaded: boolean;
  activeEngagements: EngagementLike[];
};

export function computePersonLoad(engagements: EngagementLike[], today: Date = new Date()): PersonLoad {
  const activeEngagements = engagements.filter((e) => isCurrentlyActive(e, today));
  const totalActivePct = activeEngagements.reduce((sum, e) => sum + e.intensityPct, 0);
  return { totalActivePct, isOverloaded: totalActivePct > OVERLOAD_THRESHOLD_PCT, activeEngagements };
}

function rangesOverlap(a: Pick<EngagementLike, "startDate" | "endDate">, b: Pick<EngagementLike, "startDate" | "endDate">): boolean {
  const aStart = a.startDate ?? new Date(-8640000000000000); // open start = -infinity
  const aEnd = a.endDate ?? new Date(8640000000000000); // open end = +infinity
  const bStart = b.startDate ?? new Date(-8640000000000000);
  const bEnd = b.endDate ?? new Date(8640000000000000);
  return aStart <= bEnd && bStart <= aEnd;
}

export type OverlapConflict = { a: EngagementLike; b: EngagementLike };

/** Pairs of high-intensity engagements (for the SAME person, caller passes one person's list) with overlapping date ranges. */
export function findOverlapConflicts(engagements: EngagementLike[]): OverlapConflict[] {
  const high = engagements.filter((e) => e.intensityPct >= HIGH_INTENSITY_THRESHOLD_PCT);
  const conflicts: OverlapConflict[] = [];
  for (let i = 0; i < high.length; i++) {
    for (let j = i + 1; j < high.length; j++) {
      if (high[i].projectId === high[j].projectId) continue; // same project isn't a cross-project conflict
      if (rangesOverlap(high[i], high[j])) conflicts.push({ a: high[i], b: high[j] });
    }
  }
  return conflicts;
}

export type MonthlyIntensity = { month: Date; intensityPct: number };

/**
 * Resolves an engagement's intensity for one calendar month from its
 * monthly breakdown rows. A month with no row means nothing's been logged
 * for it — resolved as 0, never inherited from a neighboring month.
 */
export function intensityForMonth(months: MonthlyIntensity[], targetMonth: Date): number {
  return (
    months.find((m) => m.month.getUTCFullYear() === targetMonth.getUTCFullYear() && m.month.getUTCMonth() === targetMonth.getUTCMonth())
      ?.intensityPct ?? 0
  );
}
