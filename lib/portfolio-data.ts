import type { Prisma } from "@prisma/client";
import { PM_STAGES } from "@/lib/seed-data";
import {
  budgetEntriesFromSprints,
  toSprintsForBudget,
  currentStage,
  checklistCompletionPct,
  trancheAmount,
  computeEvm,
  COMPLETED_STAGE_LABEL,
} from "@/lib/calculations";
import { computeProjectRag, type Rag } from "@/lib/rag";

// A portfolio index needs at least this many active projects with real data
// before it's shown as a percentage — a single project's SPI/CPI (especially
// a degenerate 0.00 from a just-started sprint) would otherwise swing the
// whole portfolio number to an extreme and read as "the portfolio is in
// trouble" when really "we don't have data yet."
const MIN_HEALTH_SAMPLE = 2;

// The exact `include` this module needs from `prisma.project.findMany` — kept
// next to the code that consumes it so the two can never drift apart.
export const PORTFOLIO_PROJECT_INCLUDE = {
  sprints: {
    orderBy: { startDate: "asc" as const },
    include: { tasks: { include: { person: { include: { roleRate: true } } } } },
  },
  risks: true,
  checklistItems: { include: { milestonePayment: true } },
  memberships: { where: { role: "PM" as const }, include: { user: { select: { name: true } } }, take: 1 },
  dependencies: { where: { status: "Blocked" as const }, select: { id: true } },
} satisfies Prisma.ProjectInclude;

type ProjectWithPortfolioData = Prisma.ProjectGetPayload<{ include: typeof PORTFOLIO_PROJECT_INCLUDE }>;

export type AttentionSeverity = "Critical" | "High" | "Medium" | "Low";
export type AttentionIssue = { severity: AttentionSeverity; label: string };

export const SEVERITY_RANK: Record<AttentionSeverity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// "Not Invoiced": nothing billed yet. "Outstanding": something's been billed
// and is still awaiting payment. "Fully Paid": everything ever billed has
// been collected. True partial-payment tracking would need milestone-level
// detail this rollup deliberately doesn't carry — "Outstanding" already
// covers "some of it is unpaid," which is the actionable distinction here.
export type FinancialStatus = "NOT_INVOICED" | "OUTSTANDING" | "PAID";

export type PortfolioRow = {
  id: string;
  name: string;
  client: string | null;
  status: "ACTIVE" | "ARCHIVED";
  pmName: string | null;
  stage: string;
  progress: number;
  contractValue: number;
  rag: Rag;
  latestSpi: number | null;
  latestCpi: number | null;
  openHighRisks: number;
  openRisks: number;
  blockedDependencies: number;
  paidAmount: number;
  invoicedAmount: number; // billed, awaiting payment
  nextPaymentAmount: number; // work done (has an Actual Date) but not yet invoiced
  financialStatus: FinancialStatus;
  nextMilestone: { name: string; date: Date; owner: string | null } | null;
  updatedAt: Date;
  hasMissingData: boolean;
  issues: AttentionIssue[]; // sorted most-severe first
};

export type MilestoneEvent = {
  projectId: string;
  projectName: string;
  name: string;
  date: Date;
  owner: string | null;
};

function buildAttentionIssues(input: {
  openHighRisks: number;
  latestSpi: number | null;
  latestCpi: number | null;
  nextMilestone: { name: string; date: Date } | null;
  blockedDependencies: number;
  hasMissingData: boolean;
  overdueChecklistCount: number;
}): AttentionIssue[] {
  const issues: AttentionIssue[] = [];
  const today = new Date();

  if (input.openHighRisks > 0) {
    issues.push({ severity: "High", label: `${input.openHighRisks} High Risk${input.openHighRisks > 1 ? "s" : ""}` });
  }
  if (input.nextMilestone && input.nextMilestone.date < today) {
    issues.push({ severity: "High", label: `"${input.nextMilestone.name}" overdue` });
  }
  if (input.latestCpi != null) {
    if (input.latestCpi < 0.9) issues.push({ severity: "High", label: `CPI ${input.latestCpi.toFixed(2)}` });
    else if (input.latestCpi < 1) issues.push({ severity: "Medium", label: `CPI ${input.latestCpi.toFixed(2)}` });
  }
  if (input.latestSpi != null) {
    if (input.latestSpi < 0.9) issues.push({ severity: "High", label: `SPI ${input.latestSpi.toFixed(2)}` });
    else if (input.latestSpi < 1) issues.push({ severity: "Medium", label: `SPI ${input.latestSpi.toFixed(2)}` });
  } else if (input.overdueChecklistCount > 0) {
    // No sprint/EVM data to judge schedule from — fall back to the checklist's
    // own overdue count as the next-best schedule signal.
    issues.push({ severity: "Medium", label: `${input.overdueChecklistCount} overdue checklist item${input.overdueChecklistCount > 1 ? "s" : ""}` });
  }
  if (input.blockedDependencies > 0) {
    issues.push({ severity: "Medium", label: `${input.blockedDependencies} blocked dependenc${input.blockedDependencies > 1 ? "ies" : "y"}` });
  }
  if (input.hasMissingData) {
    issues.push({ severity: "Low", label: "Missing PM or contract value" });
  }

  return issues.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function buildPortfolioRow(
  p: ProjectWithPortfolioData,
  today: Date
): { row: PortfolioRow; milestoneEvents: MilestoneEvent[]; incompleteCount: number; overdueCount: number } {
  const budgetEntries = budgetEntriesFromSprints(toSprintsForBudget(p.sprints), p.plannedStoryPoints);
  const { rag, latestSpi, latestCpi, openHighRisks } = computeProjectRag({
    contractValue: p.contractValue,
    budgetEntries,
    risks: p.risks,
  });

  const pmItems = p.checklistItems.filter((i) => i.type === "PM");
  // Same "first stage with incomplete work" definition as the single-project
  // Dashboard (lib/dashboard-data.ts) — null (every stage done) reads as
  // "Completed" here, since the Portfolio table needs a stage *label*.
  const stage = currentStage(pmItems, PM_STAGES) ?? COMPLETED_STAGE_LABEL;
  const progress = checklistCompletionPct(p.checklistItems);

  const openRisks = p.risks.filter((r) => r.type === "Risk" && r.status !== "Closed" && r.status !== "Mitigated").length;

  const milestoneItems = p.checklistItems.filter((i) => i.milestonePayment != null);
  const paidAmount = milestoneItems
    .filter((i) => i.milestonePayment!.invoiceStatus === "Paid")
    .reduce((sum, i) => sum + trancheAmount(p.contractValue, i.milestonePayment!.paymentPct), 0);
  const invoicedAmount = milestoneItems
    .filter((i) => i.milestonePayment!.invoiceStatus === "Invoiced")
    .reduce((sum, i) => sum + trancheAmount(p.contractValue, i.milestonePayment!.paymentPct), 0);
  // Same "next payment" definition as the single-project Dashboard's tile:
  // work that's done (has an Actual Date) but hasn't been invoiced yet.
  const nextPaymentAmount = milestoneItems
    .filter((i) => i.milestonePayment!.invoiceStatus === "Not Invoiced" && i.actualDate)
    .reduce((sum, i) => sum + trancheAmount(p.contractValue, i.milestonePayment!.paymentPct), 0);

  const financialStatus: FinancialStatus = invoicedAmount > 0 ? "OUTSTANDING" : paidAmount > 0 ? "PAID" : "NOT_INVOICED";

  const upcomingMilestoneItems = milestoneItems
    .filter((i) => i.status !== "COMPLETED" && i.status !== "NOT_APPLICABLE" && i.plannedDate)
    .sort((a, b) => a.plannedDate!.getTime() - b.plannedDate!.getTime());

  const milestoneEvents: MilestoneEvent[] = upcomingMilestoneItems.map((i) => ({
    projectId: p.id,
    projectName: p.name,
    name: i.milestoneName ?? i.itemText,
    date: i.plannedDate as Date,
    owner: i.owner,
  }));

  const incomplete = p.checklistItems.filter((i) => i.status !== "COMPLETED" && i.status !== "NOT_APPLICABLE");
  const overdue = incomplete.filter((i) => i.plannedDate && i.plannedDate < today);

  const hasMissingData = p.memberships.length === 0 || p.contractValue <= 0;
  const nextMilestone = milestoneEvents[0] ? { name: milestoneEvents[0].name, date: milestoneEvents[0].date, owner: milestoneEvents[0].owner } : null;

  const issues = buildAttentionIssues({
    openHighRisks,
    latestSpi,
    latestCpi,
    nextMilestone,
    blockedDependencies: p.dependencies.length,
    hasMissingData,
    overdueChecklistCount: overdue.length,
  });

  const row: PortfolioRow = {
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    pmName: p.memberships[0]?.user.name ?? null,
    stage,
    progress,
    contractValue: p.contractValue,
    rag,
    latestSpi,
    latestCpi,
    openHighRisks,
    openRisks,
    blockedDependencies: p.dependencies.length,
    paidAmount,
    invoicedAmount,
    nextPaymentAmount,
    financialStatus,
    nextMilestone,
    updatedAt: p.updatedAt,
    hasMissingData,
    issues,
  };

  return { row, milestoneEvents, incompleteCount: incomplete.length, overdueCount: overdue.length };
}

export type HealthIndex = {
  value: number | null; // 0-1, null when there isn't enough data to be meaningful
  sampleSize: number;
  eligible: number; // how many active projects *could* have contributed
};

export type TrendPoint = { weekEnding: string; spi: number | null; cpi: number | null };

export type PortfolioSummary = {
  totalProjects: number;
  activeProjects: number;
  healthy: number;
  atRisk: number;
  critical: number;
  completed: number;
  totalContractValue: number;
  collected: number;
  outstanding: number;
  upcomingInvoice: number;
  invoicedTotal: number; // collected + outstanding — everything ever billed
  // The four index bars in "Portfolio Health" — each carries its own sample
  // size so the UI can explain *why* it's N/A rather than just saying so.
  scheduleHealth: HealthIndex; // avg of min(latest SPI, 1) — capped so ahead-of-schedule can't mask a late sibling project
  budgetHealth: HealthIndex; // avg of min(latest CPI, 1)
  deliveryHealth: HealthIndex; // avg of (1 - overdue checklist items / incomplete checklist items)
  riskHealth: HealthIndex; // share of active projects with zero open high-severity risks
};

export type PortfolioData = {
  rows: PortfolioRow[];
  summary: PortfolioSummary;
  upcomingMilestones: MilestoneEvent[];
  trendPoints: TrendPoint[];
};

export function buildPortfolioData(projects: ProjectWithPortfolioData[]): PortfolioData {
  const today = new Date();
  const built = projects.map((p) => buildPortfolioRow(p, today));

  const rows = built.map((b) => b.row);
  const active = built.filter((b) => b.row.status === "ACTIVE");

  const healthy = active.filter((b) => b.row.rag === "GREEN").length;
  const atRisk = active.filter((b) => b.row.rag === "AMBER").length;
  const critical = active.filter((b) => b.row.rag === "RED").length;
  const completed = rows.filter((r) => r.stage === COMPLETED_STAGE_LABEL).length;

  const totalContractValue = rows.reduce((sum, r) => sum + r.contractValue, 0);
  const collected = rows.reduce((sum, r) => sum + r.paidAmount, 0);
  const outstanding = rows.reduce((sum, r) => sum + r.invoicedAmount, 0);
  const upcomingInvoice = rows.reduce((sum, r) => sum + r.nextPaymentAmount, 0);

  const spiRows = active.filter((b) => b.row.latestSpi != null);
  const scheduleHealth: HealthIndex = {
    value: spiRows.length >= MIN_HEALTH_SAMPLE ? spiRows.reduce((sum, b) => sum + Math.min(b.row.latestSpi as number, 1), 0) / spiRows.length : null,
    sampleSize: spiRows.length,
    eligible: active.length,
  };
  const cpiRows = active.filter((b) => b.row.latestCpi != null);
  const budgetHealth: HealthIndex = {
    value: cpiRows.length >= MIN_HEALTH_SAMPLE ? cpiRows.reduce((sum, b) => sum + Math.min(b.row.latestCpi as number, 1), 0) / cpiRows.length : null,
    sampleSize: cpiRows.length,
    eligible: active.length,
  };
  const deliveryRows = active.filter((b) => b.incompleteCount > 0);
  const deliveryHealth: HealthIndex = {
    value: deliveryRows.length ? deliveryRows.reduce((sum, b) => sum + (1 - b.overdueCount / b.incompleteCount), 0) / deliveryRows.length : null,
    sampleSize: deliveryRows.length,
    eligible: active.length,
  };
  const riskHealth: HealthIndex = {
    value: active.length ? active.filter((b) => b.row.openHighRisks === 0).length / active.length : null,
    sampleSize: active.length,
    eligible: active.length,
  };

  const upcomingMilestones = built.flatMap((b) => b.milestoneEvents).sort((a, b) => a.date.getTime() - b.date.getTime());

  // Portfolio-wide weekly average SPI/CPI — real history from each project's
  // own sprint-derived EVM series (lib/calculations.ts#computeEvm), grouped
  // by week-ending date. Not a stored snapshot, so a week where only one
  // project has data still shows — it's just that week's average of
  // whichever projects reported one.
  const weekMap = new Map<string, { spi: number[]; cpi: number[] }>();
  for (const p of projects) {
    const budgetEntries = budgetEntriesFromSprints(toSprintsForBudget(p.sprints), p.plannedStoryPoints);
    const evm = computeEvm(budgetEntries, p.contractValue);
    for (const e of evm) {
      const key = e.weekEnding.toISOString().slice(0, 10);
      const bucket = weekMap.get(key) ?? { spi: [], cpi: [] };
      if (e.spi != null) bucket.spi.push(e.spi);
      if (e.cpi != null) bucket.cpi.push(e.cpi);
      weekMap.set(key, bucket);
    }
  }
  const trendPoints: TrendPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekEnding, { spi, cpi }]) => ({
      weekEnding,
      spi: spi.length ? spi.reduce((s, v) => s + v, 0) / spi.length : null,
      cpi: cpi.length ? cpi.reduce((s, v) => s + v, 0) / cpi.length : null,
    }));

  return {
    rows,
    summary: {
      totalProjects: rows.length,
      activeProjects: active.length,
      healthy,
      atRisk,
      critical,
      completed,
      totalContractValue,
      collected,
      outstanding,
      upcomingInvoice,
      invoicedTotal: collected + outstanding,
      scheduleHealth,
      budgetHealth,
      deliveryHealth,
      riskHealth,
    },
    upcomingMilestones,
    trendPoints,
  };
}
