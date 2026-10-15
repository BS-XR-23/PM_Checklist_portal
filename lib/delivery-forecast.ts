// Pure, DB-free maths for the Delivery Overview: where the scope stands
// (done · in the running sprint · planned in later sprints · not in any
// upcoming sprint) and when the remaining work finishes at the pace the
// closed sprints actually delivered.

const DAY_MS = 86_400_000;

export type ScopeBreakdown = {
  total: number; // story points across the whole WBS
  done: number; // earned so far (partial progress counts proportionally)
  inCurrentSprint: number; // remaining points committed to the running sprint
  plannedLater: number; // remaining points committed to draft (not yet started) sprints
  backlog: number; // remaining points not in any upcoming sprint
  tasks: { done: number; inCurrentSprint: number; plannedLater: number; backlog: number };
};

type TaskLike = { storyPoints: number; pctComplete: number; sprintId: string | null };
type SprintState = { id: string; startedAt: Date | null; closedAt: Date | null };

export function scopeBreakdown(tasks: TaskLike[], sprints: SprintState[]): ScopeBreakdown {
  const state = new Map(sprints.map((s) => [s.id, s.closedAt ? "closed" : s.startedAt ? "running" : "draft"] as const));
  const b: ScopeBreakdown = { total: 0, done: 0, inCurrentSprint: 0, plannedLater: 0, backlog: 0, tasks: { done: 0, inCurrentSprint: 0, plannedLater: 0, backlog: 0 } };
  for (const t of tasks) {
    const pct = Math.min(Math.max(t.pctComplete, 0), 1);
    b.total += t.storyPoints;
    b.done += t.storyPoints * pct;
    const left = t.storyPoints * (1 - pct);
    if (pct >= 1) {
      b.tasks.done++;
      continue;
    }
    // A task left unfinished in a closed sprint is back in the backlog.
    const where = t.sprintId ? state.get(t.sprintId) : undefined;
    if (where === "running") {
      b.inCurrentSprint += left;
      b.tasks.inCurrentSprint++;
    } else if (where === "draft") {
      b.plannedLater += left;
      b.tasks.plannedLater++;
    } else {
      b.backlog += left;
      b.tasks.backlog++;
    }
  }
  return b;
}

export type PaceForecast = {
  pointsPerWeek: number;
  basedOnSprints: number;
  remaining: number;
  /** Estimated finish date; today when nothing is left. */
  finish: Date;
};

/**
 * Remaining points ÷ the pace the closed sprints delivered (earned points
 * per calendar day across their start–end ranges). Null until at least one
 * closed sprint earned something — no pace, no forecast.
 */
export function paceForecast(
  closedSprints: { startDate: Date; endDate: Date; earnedPoints: number }[],
  remaining: number,
  today: Date = new Date()
): PaceForecast | null {
  const days = closedSprints.reduce((sum, s) => sum + Math.max(1, Math.round((s.endDate.getTime() - s.startDate.getTime()) / DAY_MS) + 1), 0);
  const earned = closedSprints.reduce((sum, s) => sum + s.earnedPoints, 0);
  if (!days || earned <= 0) return null;
  const perDay = earned / days;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const left = Math.max(0, remaining);
  return {
    pointsPerWeek: perDay * 7,
    basedOnSprints: closedSprints.length,
    remaining: left,
    finish: new Date(start.getTime() + Math.ceil(left / perDay) * DAY_MS),
  };
}

type ReleaseLike = { id: string; deploymentStatus: string; releaseDate: Date | null; createdAt: Date };

/**
 * The releases the Overview talks about: the most recent one actually
 * deployed (by release date, not by when it was entered) and the soonest
 * one still planned or in progress. UAT sign-off is read from the deployed
 * one (else the next), never from whichever older release happened to be
 * signed.
 */
export function pickReleases<T extends ReleaseLike>(releases: T[]): { latestDeployed: T | null; next: T | null; signoffFrom: T | null } {
  const when = (r: T) => (r.releaseDate ?? r.createdAt).getTime();
  const latestDeployed = releases.filter((r) => r.deploymentStatus === "Deployed").sort((a, b) => when(b) - when(a))[0] ?? null;
  const next =
    releases
      .filter((r) => r.deploymentStatus === "Planned" || r.deploymentStatus === "In Progress")
      .sort((a, b) => (a.releaseDate?.getTime() ?? Infinity) - (b.releaseDate?.getTime() ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
  return { latestDeployed, next, signoffFrom: latestDeployed ?? next };
}
