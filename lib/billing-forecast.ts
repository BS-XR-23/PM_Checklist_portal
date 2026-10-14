import { trancheAmount } from "@/lib/calculations";
import { isMilestoneDone, milestoneDueDate } from "@/lib/milestones";

// Cash view for the Portfolio: when each project's not-yet-invoiced payment
// tranches (Milestones & Payments) are expected to be billed. Derived only
// from data PMs already enter — payment %, invoice status, milestone status
// and due date — nothing is stored.

export type BillingItem = {
  projectId: string;
  projectName: string;
  milestoneName: string;
  paymentPct: number;
  amount: number;
  due: Date | null;
};

export type BillingBucket = { amount: number; items: BillingItem[] };

export type BillingForecast = {
  /** Milestone is done but its tranche isn't invoiced yet — bill it now. */
  ready: BillingBucket;
  /** Not done, due date already passed. */
  overdue: BillingBucket;
  /** Due from today, bucketed by calendar month (UTC), `horizonMonths` long starting this month. */
  months: (BillingBucket & { month: string })[]; // month = "YYYY-MM"
  /** Due after the horizon. */
  later: BillingBucket;
  /** Has a payment % but no planned/forecast date — can't be forecast. */
  undated: BillingBucket;
  /** Contract value not assigned to any milestone's payment %. */
  unallocated: { amount: number; projects: { projectId: string; projectName: string; pct: number; amount: number }[] };
  /** Σ ready + overdue + tranches due within the next `windowDays`. */
  dueSoonAmount: number;
  dueSoonCount: number;
};

export type BillingProject = {
  id: string;
  name: string;
  contractValue: number;
  milestones: {
    name: string;
    status: string;
    plannedDate: Date | null;
    forecastDate: Date | null;
    payment: { paymentPct: number; invoiceStatus: string } | null;
  }[];
};

const NOT_INVOICED = "Not Invoiced";
const DAY_MS = 86_400_000;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function add(bucket: BillingBucket, item: BillingItem) {
  bucket.amount += item.amount;
  bucket.items.push(item);
}

export function buildBillingForecast(
  projects: BillingProject[],
  today: Date = new Date(),
  { horizonMonths = 6, windowDays = 90 }: { horizonMonths?: number; windowDays?: number } = {}
): BillingForecast {
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const windowEnd = new Date(startOfToday.getTime() + windowDays * DAY_MS);
  const monthKeys = Array.from({ length: horizonMonths }, (_, i) => monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1))));

  const empty = (): BillingBucket => ({ amount: 0, items: [] });
  const f: BillingForecast = {
    ready: empty(),
    overdue: empty(),
    months: monthKeys.map((month) => ({ month, ...empty() })),
    later: empty(),
    undated: empty(),
    unallocated: { amount: 0, projects: [] },
    dueSoonAmount: 0,
    dueSoonCount: 0,
  };

  for (const p of projects) {
    let allocatedPct = 0;
    for (const m of p.milestones) {
      const pct = m.payment?.paymentPct ?? 0;
      allocatedPct += pct;
      // Already billed, nothing to bill, or dropped from scope (N/A).
      if (pct <= 0 || !m.payment || m.payment.invoiceStatus !== NOT_INVOICED || m.status === "NOT_APPLICABLE") continue;

      const due = milestoneDueDate({ plannedDate: m.plannedDate, forecastDate: m.forecastDate });
      const item: BillingItem = { projectId: p.id, projectName: p.name, milestoneName: m.name, paymentPct: pct, amount: trancheAmount(p.contractValue, pct), due };
      const done = isMilestoneDone(m);

      if (done) add(f.ready, item);
      else if (!due) add(f.undated, item);
      else if (due < startOfToday) add(f.overdue, item);
      else add(f.months.find((b) => b.month === monthKey(due)) ?? f.later, item);

      if (done || (due != null && due < windowEnd)) {
        f.dueSoonAmount += item.amount;
        f.dueSoonCount++;
      }
    }
    const missingPct = Math.max(0, 1 - allocatedPct);
    if (p.contractValue > 0 && missingPct > 0.0001) {
      const amount = p.contractValue * missingPct;
      f.unallocated.amount += amount;
      f.unallocated.projects.push({ projectId: p.id, projectName: p.name, pct: missingPct, amount });
    }
  }

  for (const b of [f.ready, f.overdue, f.later, f.undated, ...f.months]) {
    b.items.sort((a, c) => (a.due?.getTime() ?? Infinity) - (c.due?.getTime() ?? Infinity));
  }
  f.unallocated.projects.sort((a, b) => b.amount - a.amount);
  return f;
}
