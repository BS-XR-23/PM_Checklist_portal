export function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** No year — for tight spaces (card stat chips) where the full formatDate() truncates. Pair with a title="" tooltip for the exact date. */
export function formatShortDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Parses a yyyy-mm-dd <input type=date> value as a local-midnight Date, avoiding UTC off-by-one. */
export function parseDateInput(value: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

/** yyyy-mm-dd for <input type=date>, using local time to avoid off-by-one from UTC. */
export function toDateInputValue(value: Date | string | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Normalizes any date to the 1st of its month at UTC midnight — the unit ProjectEngagementMonth.month is stored/queried in. */
export function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

/** Parses a `?month=yyyy-MM` search param into a UTC first-of-month Date; falls back to the current month when missing/invalid. */
export function parseMonthParam(value: string | string[] | undefined): Date {
  const s = Array.isArray(value) ? value[0] : value;
  if (s && /^\d{4}-\d{2}$/.test(s)) {
    const [year, month] = s.split("-").map(Number);
    if (month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
  }
  return startOfMonthUTC(new Date());
}

/** yyyy-MM for building `?month=` links. */
export function toMonthParam(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "July 2026" display label for the month a Resourcing navigator is currently showing. */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

/** "Aug 26" compact label — for the Resourcing tab's prev/current/next month tab strip. */
export function formatMonthShortLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "2-digit", month: "short", timeZone: "UTC" });
}

/** Case/whitespace-insensitive key for spotting likely-duplicate WBS task titles. */
export function normalizeTaskTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Natural sort for dotted WBS numbers ("2.10" after "2.9", not before "2.2"
 * the way a plain string sort would). Blank WBS# sorts last, since it means
 * "not yet numbered" rather than "comes first".
 */
export function compareWbsNumbers(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const aParts = a.split(".");
  const bParts = b.split(".");
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i];
    const bp = bParts[i];
    if (ap === undefined) return -1;
    if (bp === undefined) return 1;
    const an = Number(ap);
    const bn = Number(bp);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
    if (ap !== bp) return ap.localeCompare(bp);
  }
  return 0;
}
