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
