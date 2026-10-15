// Pure, DB-free rules for the Risk Register and CR Log, shared by the
// pages, their exports, and project health (lib/project-health.ts) so the
// tiles on Risk & CR always agree with what turns a project Critical.
import { riskScore, crAmount } from "@/lib/calculations";

// Realized = the risk happened and is still being dealt with, so it stays
// open. Not Pursued is for opportunities that were let go.
export const RISK_OPEN_STATUSES = ["Open", "Monitoring", "Realized"] as const;
export const RISK_CLOSED_STATUSES = ["Mitigated", "Closed", "Not Pursued"] as const;

export function isRiskOpen(status: string): boolean {
  return (RISK_OPEN_STATUSES as readonly string[]).includes(status);
}

type RiskLike = { type: string; status: string; probability: string; impact: string };

/** Score 6–9 on an open Risk or Issue — what makes a project Critical. Opportunities never count. */
export function isOpenHighThreat(r: RiskLike): boolean {
  return r.type !== "Opportunity" && isRiskOpen(r.status) && riskScore(r.probability, r.impact) >= 6;
}

export type RiskSummary = {
  openHigh: number; // Risks + Issues only
  openMedium: number;
  openLow: number;
  openOpportunities: number;
  closed: number;
};

export function summarizeRisks(risks: RiskLike[]): RiskSummary {
  const s: RiskSummary = { openHigh: 0, openMedium: 0, openLow: 0, openOpportunities: 0, closed: 0 };
  for (const r of risks) {
    if (!isRiskOpen(r.status)) s.closed++;
    else if (r.type === "Opportunity") s.openOpportunities++;
    else {
      const score = riskScore(r.probability, r.impact);
      if (score >= 6) s.openHigh++;
      else if (score >= 3) s.openMedium++;
      else s.openLow++;
    }
  }
  return s;
}

/** Open items first, worst score first; then most recently raised. */
export function sortRisks<T extends RiskLike & { dateRaised: Date | null }>(risks: T[]): T[] {
  return [...risks].sort((a, b) => {
    const open = Number(isRiskOpen(b.status)) - Number(isRiskOpen(a.status));
    if (open) return open;
    const score = riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact);
    if (score) return score;
    return (b.dateRaised?.getTime() ?? 0) - (a.dateRaised?.getTime() ?? 0);
  });
}

/**
 * The Date Closed change that goes with a status change: closing stamps
 * today if no date was set; reopening clears it. undefined = leave as is.
 */
export function dateClosedForStatus(nextStatus: string, current: Date | null, today: Date): Date | null | undefined {
  if (isRiskOpen(nextStatus)) return current ? null : undefined;
  return current ? undefined : today;
}

// --- Change requests ---

/** Statuses where the client has agreed to the change. */
export const CR_AGREED_STATUSES = ["Approved", "In Progress", "Completed"] as const;

type CrLike = {
  type: string;
  status: string;
  manDaysPlanned: number | null;
  billableManDays: number | null;
  rate: number | null;
  clientSignoff: string;
  wbsUpdated: string;
};

export function isCrAgreed(status: string): boolean {
  return (CR_AGREED_STATUSES as readonly string[]).includes(status);
}

export type CrSummary = {
  proposed: { count: number; plannedManDays: number };
  inWork: { count: number; billableManDays: number }; // Approved + In Progress
  completed: number;
  rejected: number;
  /** Billable amount of agreed Paid CRs — what they add on top of the contract. */
  paidValue: number;
};

export function summarizeCrs(crs: CrLike[]): CrSummary {
  const s: CrSummary = { proposed: { count: 0, plannedManDays: 0 }, inWork: { count: 0, billableManDays: 0 }, completed: 0, rejected: 0, paidValue: 0 };
  for (const c of crs) {
    if (c.status === "Proposed") {
      s.proposed.count++;
      s.proposed.plannedManDays += c.manDaysPlanned ?? 0;
    } else if (c.status === "Approved" || c.status === "In Progress") {
      s.inWork.count++;
      s.inWork.billableManDays += c.billableManDays ?? 0;
    } else if (c.status === "Completed") s.completed++;
    else if (c.status === "Rejected") s.rejected++;
    if (c.type === "Paid" && isCrAgreed(c.status)) s.paidValue += crAmount(c.billableManDays, c.rate) ?? 0;
  }
  return s;
}

/** Things to fix on one CR. `financialsHidden` drops the rate check for viewers who can't see rates. */
export function crWarnings(c: CrLike, financialsHidden = false): string[] {
  if (!isCrAgreed(c.status)) return [];
  const w: string[] = [];
  if (c.clientSignoff === "Pending") w.push("No client sign-off yet");
  if (c.wbsUpdated !== "Yes") w.push("WBS not updated");
  if (c.type === "Paid" && !financialsHidden && (c.billableManDays == null || c.rate == null)) w.push("No billable man-days or rate — amount unknown");
  return w;
}
