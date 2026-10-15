// Pure, DB-free rules for checklist items: the counts the Checklist page's
// tiles show, the per-row "N days late" / "Due in N days" flag, the Actual
// date that goes with a status change, and link cleanup. Shared by the page,
// the server actions and the Portfolio so they can't disagree.

import { isTrackedChecklistItem, reminderBand } from "@/lib/calculations";

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

type ItemLike = { status: string; plannedDate: Date | null; actualDate: Date | null; isRecurring?: boolean };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Not done, not N/A, not a cadence item, and its planned date has passed (due today isn't late). */
export function isChecklistItemOverdue(i: ItemLike, today: Date = new Date()): boolean {
  return isTrackedChecklistItem(i) && reminderBand(i.plannedDate, i.status === "COMPLETED", today) === "OVERDUE";
}

export type ChecklistFlag = { tone: "red" | "amber" | "slate"; text: string };

/**
 * The one-line flag under an item: late or due within a week while open,
 * or "done N days late" once it was completed after its planned date.
 * Same bands as reminderBand, so the row, the tiles, the Dashboard and
 * Reminders all agree on what's overdue.
 */
export function checklistFlag(i: ItemLike, today: Date = new Date()): ChecklistFlag | null {
  if (!isTrackedChecklistItem(i) || !i.plannedDate) return null;
  if (i.status === "COMPLETED") {
    const late = i.actualDate ? daysBetween(i.plannedDate, i.actualDate) : 0;
    return late > 0 ? { tone: "slate", text: `Done ${plural(late, "day")} late` } : null;
  }
  const left = daysBetween(today, i.plannedDate);
  if (left < 0) return { tone: "red", text: `${plural(-left, "day")} late` };
  if (left === 0) return { tone: "amber", text: "Due today" };
  if (left <= 7) return { tone: "amber", text: `Due in ${plural(left, "day")}` };
  return null;
}

export type ChecklistSummary = {
  applicable: number;
  completed: number;
  pct: number;
  inProgress: number;
  notStarted: number;
  dueThisWeek: number;
  overdue: number;
};

/** Tile counts. N/A and cadence items are out of every number (see isTrackedChecklistItem). */
export function summarizeChecklist(items: ItemLike[], today: Date = new Date()): ChecklistSummary {
  const applicable = items.filter(isTrackedChecklistItem);
  const completed = applicable.filter((i) => i.status === "COMPLETED").length;
  const band = (i: ItemLike) => reminderBand(i.plannedDate, i.status === "COMPLETED", today);
  return {
    applicable: applicable.length,
    completed,
    pct: applicable.length ? completed / applicable.length : 0,
    inProgress: applicable.filter((i) => i.status === "IN_PROGRESS").length,
    notStarted: applicable.filter((i) => i.status === "NOT_STARTED").length,
    dueThisWeek: applicable.filter((i) => band(i) === "DUE_SOON").length,
    overdue: applicable.filter((i) => band(i) === "OVERDUE").length,
  };
}

/**
 * The Actual date that goes with a status change: completing stamps today
 * when none is set; reopening a completed item clears the date it was done.
 * undefined = leave as is.
 */
export function checklistActualDateForStatus(prevStatus: string, nextStatus: string, current: Date | null, today: Date): Date | null | undefined {
  if (nextStatus === "COMPLETED") return current ? undefined : today;
  if (prevStatus === "COMPLETED" && nextStatus !== "NOT_APPLICABLE" && current) return null;
  return undefined;
}

/** "today" / "yesterday" / "N days ago" for a cadence item's last-done date. */
export function lastDoneLabel(date: Date, today: Date = new Date()): string {
  const ago = daysBetween(date, today);
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  return `${ago} days ago`;
}

/**
 * Cleans a typed link before it's saved: blank → null, a bare
 * "drive.google.com/..." gets https:// (otherwise it opens as a broken page
 * inside the portal), and anything that isn't http(s) — javascript:, data:,
 * file: — is refused so a saved link can never run code for whoever clicks it.
 */
export function normalizeLink(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Links must be http:// or https:// addresses.");
  return withScheme;
}

/** The link to put in an href, or null when a stored value isn't a safe http(s) address. */
export function safeHref(value: string | null): string | null {
  try {
    return value ? normalizeLink(value) : null;
  } catch {
    return null;
  }
}
