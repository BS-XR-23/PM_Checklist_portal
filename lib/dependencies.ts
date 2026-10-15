// Pure, DB-free rules for the Dependency Tracker, shared by the page, its
// export, project health, the Dashboard, Portfolio and Reminders so
// "overdue" means the same thing everywhere.

export type DependencyLike = { status: string; priority: string; expectedDate: Date | null };

const DAY_MS = 86_400_000;
const PRIORITY_RANK: Record<string, number> = { Extreme: 4, High: 3, Medium: 2, Low: 1 };

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Days until the expected date (negative = overdue), or null when it's received or undated. */
export function dependencyDaysLeft(d: DependencyLike, today: Date = new Date()): number | null {
  if (d.status === "Done" || !d.expectedDate) return null;
  return Math.round((startOfDay(d.expectedDate).getTime() - startOfDay(today).getTime()) / DAY_MS);
}

/** Not received and the expected date has passed. Blocked items count too — they still haven't arrived. */
export function isDependencyOverdue(d: DependencyLike, today: Date = new Date()): boolean {
  const left = dependencyDaysLeft(d, today);
  return left != null && left < 0;
}

/** High or Extreme priority — the ones that move project health and Reminders. */
export function isUrgentDependency(d: { priority: string }): boolean {
  return (PRIORITY_RANK[d.priority] ?? 0) >= PRIORITY_RANK.High;
}

export function countOverdueUrgentDependencies(deps: DependencyLike[], today: Date = new Date()): number {
  return deps.filter((d) => isUrgentDependency(d) && isDependencyOverdue(d, today)).length;
}

/**
 * Worst first: outstanding before received; overdue before on-time; then
 * higher priority, then the earlier expected date (undated last).
 */
export function sortDependencies<T extends DependencyLike>(deps: T[], today: Date = new Date()): T[] {
  const key = (d: T) => {
    const left = dependencyDaysLeft(d, today);
    return {
      done: d.status === "Done" ? 1 : 0,
      overdue: left != null && left < 0 ? 0 : 1,
      priority: -(PRIORITY_RANK[d.priority] ?? 0),
      date: d.expectedDate ? d.expectedDate.getTime() : Infinity,
    };
  };
  return [...deps].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.done - kb.done || ka.overdue - kb.overdue || ka.priority - kb.priority || ka.date - kb.date;
  });
}

export type DependencyOverdueSummary = { count: number; oldestDays: number; urgent: number; from: string[] };

/** Overdue dependencies in one line's worth of numbers: how many, the oldest, how many are High/Extreme, and who from. */
export function summarizeOverdueDependencies(deps: (DependencyLike & { responsible: string | null })[], today: Date = new Date()): DependencyOverdueSummary {
  const overdue = deps.filter((d) => isDependencyOverdue(d, today));
  return {
    count: overdue.length,
    oldestDays: overdue.reduce((max, d) => Math.max(max, -(dependencyDaysLeft(d, today) ?? 0)), 0),
    urgent: overdue.filter(isUrgentDependency).length,
    from: Array.from(new Set(overdue.map((d) => d.responsible?.trim()).filter((v): v is string => !!v))),
  };
}
