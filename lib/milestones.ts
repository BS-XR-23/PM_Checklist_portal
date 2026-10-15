// Milestone rollups shared by the Dashboard, Projects cards, and Portfolio,
// so "next milestone", "planned end", and "next payment" mean the same thing
// on every page. Milestones are the client-facing Milestone rows (with their
// optional MilestonePayment) — never checklist gates.
import { trancheAmount } from "@/lib/calculations";

export type MilestoneLike = {
  id: string;
  name: string;
  status: string;
  plannedDate: Date | null;
  forecastDate: Date | null;
  actualDate: Date | null;
  ownerName?: string | null;
  payment: { paymentPct: number; invoiceStatus: string } | null;
};

export function isMilestoneDone(m: { status: string }): boolean {
  return m.status === "COMPLETED" || m.status === "NOT_APPLICABLE";
}

/** The date a milestone is currently expected: its forecast if re-forecast, else its plan. */
export function milestoneDueDate(m: { plannedDate: Date | null; forecastDate: Date | null }): Date | null {
  return m.forecastDate ?? m.plannedDate;
}

export type MilestoneSummary = {
  /** First not-done milestone due today or later. Overdue ones are counted separately, never shown as "next". */
  nextMilestone: { name: string; date: Date; owner: string | null } | null;
  overdue: { name: string; date: Date; owner: string | null }[];
  /** Latest due date across applicable milestones — the project's planned end. */
  plannedEnd: Date | null;
  /** Earliest-due milestone carrying an un-invoiced tranche (> 0%). */
  nextPayment: { name: string; date: Date | null; amount: number } | null;
  paidAmount: number;
  invoicedAmount: number; // billed, awaiting payment
  totalAllocatedPct: number;
};

export function summarizeMilestones(milestones: MilestoneLike[], contractValue: number, today: Date = new Date()): MilestoneSummary {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const open = milestones
    .filter((m) => !isMilestoneDone(m) && milestoneDueDate(m))
    .map((m) => ({ name: m.name, date: milestoneDueDate(m) as Date, owner: m.ownerName ?? null }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const overdue = open.filter((m) => m.date < startOfToday);
  const nextMilestone = open.find((m) => m.date >= startOfToday) ?? null;

  const plannedEnd = milestones
    .filter((m) => m.status !== "NOT_APPLICABLE")
    .reduce<Date | null>((latest, m) => {
      const d = m.actualDate ?? milestoneDueDate(m);
      return d && (!latest || d > latest) ? d : latest;
    }, null);

  const pct = (m: MilestoneLike) => m.payment?.paymentPct ?? 0;
  const unbilled = milestones
    .filter((m) => pct(m) > 0 && (m.payment?.invoiceStatus ?? "Not Invoiced") === "Not Invoiced")
    .map((m) => ({ name: m.name, date: m.actualDate ?? milestoneDueDate(m), amount: trancheAmount(contractValue, pct(m)) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));

  const sumWhere = (status: string) =>
    milestones.filter((m) => m.payment?.invoiceStatus === status).reduce((sum, m) => sum + trancheAmount(contractValue, pct(m)), 0);

  return {
    nextMilestone,
    overdue,
    plannedEnd,
    nextPayment: unbilled[0] ?? null,
    paidAmount: sumWhere("Paid"),
    invoicedAmount: sumWhere("Invoiced"),
    totalAllocatedPct: milestones.reduce((sum, m) => sum + pct(m), 0),
  };
}

export type MoneySplit = { contractValue: number; collected: number; awaiting: number; scheduled: number; unallocated: number };

/**
 * Contract value split four ways — collected · invoiced, awaiting payment ·
 * on a milestone but not invoiced · not on any milestone. The Dashboard and
 * Milestones & Payments both show this, so it's computed once here.
 */
export function contractMoneySplit(contractValue: number, s: Pick<MilestoneSummary, "paidAmount" | "invoicedAmount" | "totalAllocatedPct">): MoneySplit {
  const allocatedValue = contractValue * Math.min(1, s.totalAllocatedPct);
  return {
    contractValue,
    collected: s.paidAmount,
    awaiting: s.invoicedAmount,
    scheduled: Math.max(0, allocatedValue - s.paidAmount - s.invoicedAmount),
    unallocated: Math.max(0, contractValue - allocatedValue),
  };
}

/**
 * The Actual date that goes with a status change: completing stamps today
 * if none is set; reopening clears it. undefined = leave as is.
 * Not Applicable leaves the date alone either way.
 */
export function actualDateForStatus(nextStatus: string, current: Date | null, today: Date): Date | null | undefined {
  if (nextStatus === "NOT_APPLICABLE") return undefined;
  if (nextStatus === "COMPLETED") return current ? undefined : today;
  return current ? null : undefined;
}

export type MilestoneFlag = { tone: "red" | "amber" | "blue"; text: string };

const DAY_MS = 86_400_000;

/**
 * What's wrong (or due) on one milestone, worst first. Money flags are left
 * out when the viewer can't see payment details.
 */
export function milestoneFlags(
  m: {
    status: string;
    plannedDate: Date | null;
    forecastDate: Date | null;
    actualDate: Date | null;
    payment: { paymentPct: number; invoiceStatus: string; clientSignoff: string } | null;
  },
  today: Date = new Date(),
  showMoney = true
): MilestoneFlag[] {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const done = isMilestoneDone(m);
  const due = milestoneDueDate(m);
  const invoice = m.payment?.invoiceStatus ?? "Not Invoiced";
  const signoff = m.payment?.clientSignoff ?? "Pending";
  const flags: MilestoneFlag[] = [];

  if (!done && showMoney && invoice !== "Not Invoiced") flags.push({ tone: "red", text: `${invoice} but not completed — update the status` });
  if (!done && due && due < startOfToday) {
    const days = Math.round((startOfToday.getTime() - due.getTime()) / DAY_MS);
    flags.push({ tone: "red", text: `Overdue by ${days} day${days === 1 ? "" : "s"}` });
  }
  if (!done && !due) flags.push({ tone: "amber", text: "No date" });
  if (!done && m.plannedDate && m.forecastDate && m.forecastDate > m.plannedDate) {
    const days = Math.round((m.forecastDate.getTime() - m.plannedDate.getTime()) / DAY_MS);
    flags.push({ tone: "amber", text: `Forecast ${days} day${days === 1 ? "" : "s"} after plan` });
  }
  if (!done && (signoff === "Signed" || signoff === "Acknowledged")) flags.push({ tone: "amber", text: `Client sign-off is ${signoff} but not completed` });
  if (m.status === "COMPLETED" && !m.actualDate) flags.push({ tone: "amber", text: "No actual date" });
  if (m.status === "COMPLETED" && showMoney && (m.payment?.paymentPct ?? 0) > 0 && invoice === "Not Invoiced") flags.push({ tone: "blue", text: "Ready to invoice" });
  return flags;
}
