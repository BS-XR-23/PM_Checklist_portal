import { prisma } from "@/lib/prisma";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { computeProjectRag } from "@/lib/rag";
import {
  riskScore,
  computeEvm,
  trancheAmount,
  reminderBand,
  checklistCompletionPct,
  budgetEntriesFromSprints,
  toSprintsForBudget,
} from "@/lib/calculations";

export async function getDashboardData(projectId: string) {
  const [project, allItems, risks, crs, sprints, milestones, actionItems, recentDecisionsRaw] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    // One query for both checklists (differ only by `type`) instead of two —
    // filtering below preserves the orderBy order within each subset.
    prisma.checklistItem.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.riskItem.findMany({ where: { projectId } }),
    prisma.changeRequest.findMany({ where: { projectId } }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: "asc" },
      include: { tasks: { include: { person: { include: { roleRate: true } } } } },
      relationLoadStrategy: "join",
    }),
    prisma.milestonePayment.findMany({ where: { checklistItem: { projectId } }, include: { checklistItem: true } }),
    prisma.actionItem.findMany({ where: { projectId, dueDate: { not: null } }, include: { ownerPerson: { select: { name: true } } } }),
    prisma.decisionLogItem.findMany({ where: { projectId }, orderBy: { order: "desc" }, take: 5, include: { decidedByPerson: { select: { name: true } } } }),
  ]);

  const recentDecisions = recentDecisionsRaw.map((d) => ({
    id: d.id,
    decision: d.decision,
    date: d.date,
    decidedByName: d.decidedByPerson?.name ?? d.decidedBy ?? null,
  }));

  // N/A items don't count toward completion at all — not the numerator
  // (obviously not completed) and not the denominator either (they're not
  // part of this project's plan, same as if the template item weren't there).
  const applicableItems = allItems.filter((i) => i.status !== "NOT_APPLICABLE");
  const totalItems = applicableItems.length;
  const completedItems = applicableItems.filter((i) => i.status === "COMPLETED").length;
  const overallPct = checklistCompletionPct(allItems);

  // Status breakdown stays over ALL items — seeing "N marked Not Applicable"
  // as its own slice is useful; it's only the percentage-complete math above
  // that excludes them.
  const statusBreakdown = ITEM_STATUSES.map((status) => ({
    status,
    count: allItems.filter((i) => i.status === status).length,
  }));

  // Checklist types this project has no items in at all (e.g. a project that
  // never turned on Engineering/QA/Dev checklists) are dropped rather than
  // shown as a permanent 0/0 row — dead rows were the biggest source of
  // "disorganized" scroll depth on this page.
  const perChecklistSummary = CHECKLIST_TYPES.map((c) => {
    const items = allItems.filter((i) => i.type === c.key);
    const applicable = items.filter((i) => i.status !== "NOT_APPLICABLE");
    const completed = applicable.filter((i) => i.status === "COMPLETED").length;
    return { name: c.label, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0 };
  }).filter((c) => c.total > 0);

  function stageSummary(items: typeof allItems, stages: readonly string[]) {
    return stages.map((stage) => {
      const rows = items.filter((i) => i.stage === stage);
      const applicable = rows.filter((i) => i.status !== "NOT_APPLICABLE");
      const completed = applicable.filter((i) => i.status === "COMPLETED").length;
      const plannedDates = applicable.map((r) => r.plannedDate).filter((d): d is Date => d != null);
      const actualDates = applicable.map((r) => r.actualDate).filter((d): d is Date => d != null);
      const start = plannedDates.length ? new Date(Math.min(...plannedDates.map((d) => d.getTime()))) : null;
      const end = actualDates.length ? new Date(Math.max(...actualDates.map((d) => d.getTime()))) : null;
      return { stage, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0, start, end };
    });
  }

  // One stage/category breakdown per checklist type, in registry order.
  // "Presales" is only ever populated on a project won from a Presales
  // opportunity (winPresalesProject, app/presales/actions.ts) — drop it
  // here when empty so a regular project's Dashboard doesn't show a
  // permanent "Presales: 0/0" row under PM Checklist.
  const stageSummaryByType = CHECKLIST_TYPES.map((c) => {
    const items = allItems.filter((i) => i.type === c.key);
    let stages = stageSummary(items, c.stageOrder);
    if (c.key === "PM") stages = stages.filter((s) => s.stage !== "Presales" || s.total > 0);
    return { key: c.key, label: c.label, stageLabel: c.stageLabel, stages };
  }).filter((c) => c.stages.some((s) => s.total > 0));

  // Derived, not stored — the project's "end date" (latest Actual Date
  // across every checklist item), so it can't drift out of sync with the
  // checklist itself. (A "Current Stage (PM Checklist)" figure used to live
  // here too; dropped — a single stage name pooled from just one of the
  // project's checklist types didn't earn its place next to Health/Next
  // Milestone, which are real "where are we" signals.)
  const endDate = applicableItems.reduce<Date | null>((latest, i) => {
    if (!i.actualDate) return latest;
    return !latest || i.actualDate > latest ? i.actualDate : latest;
  }, null);

  // Same reminder-worthy definition as lib/notifications.ts (cross-project
  // sidebar/notifications page) — computed here for free since allItems is
  // already loaded, no extra query for the checklist half. band is non-null
  // here by construction (reminderBand only returns null when plannedDate
  // is null or the item's done), so plannedDate is guaranteed non-null too.
  const checklistReminders = allItems
    .map((i) => ({ i, band: reminderBand(i.plannedDate, i.status === "COMPLETED" || i.status === "NOT_APPLICABLE") }))
    .filter((x): x is { i: (typeof allItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ i, band }) => ({
      id: i.id,
      source: "CHECKLIST" as const,
      route: `checklist/${CHECKLIST_TYPE_BY_KEY[i.type as ChecklistType].routeSegment}`,
      context: i.stage,
      itemText: i.itemText,
      plannedDate: i.plannedDate as Date,
      band,
    }));

  const actionItemReminders = actionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done") }))
    .filter((x): x is { a: (typeof actionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      id: a.id,
      source: "ACTION_ITEM" as const,
      route: "action-items",
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
    }));

  const reminders = [...checklistReminders, ...actionItemReminders].sort((a, b) =>
    a.band !== b.band ? (a.band === "OVERDUE" ? -1 : 1) : a.plannedDate.getTime() - b.plannedDate.getTime()
  );

  const timelineStrip = stageSummaryByType.flatMap((c) => c.stages.map((s) => ({ ...s, source: c.label })));

  const checklistTypeOrder = Object.fromEntries(CHECKLIST_TYPES.map((c, idx) => [c.key, idx]));
  const milestonesList = milestones
    .map((m) => ({
      id: m.id,
      source: CHECKLIST_TYPE_BY_KEY[m.checklistItem.type as ChecklistType].label,
      stage: m.checklistItem.stage,
      milestoneName: m.checklistItem.milestoneName ?? "",
      actualDate: m.checklistItem.actualDate,
      status: m.checklistItem.status as ItemStatus,
      order: m.checklistItem.order,
      type: m.checklistItem.type,
    }))
    .sort((a, b) => (a.type === b.type ? a.order - b.order : checklistTypeOrder[a.type] - checklistTypeOrder[b.type]));

  const evm = computeEvm(budgetEntriesFromSprints(toSprintsForBudget(sprints), project.plannedStoryPoints), project.contractValue);
  const latestEvm = [...evm].reverse().find((e) => e.spi != null || e.cpi != null) ?? null;

  const openHighRisks = risks.filter(
    (r) => r.type === "Risk" && r.status !== "Closed" && r.status !== "Mitigated" && riskScore(r.probability, r.impact) >= 6
  ).length;

  // Same health definition Portfolio/Projects already use — this page never
  // surfaced it before, despite it being exactly a "where are we" signal.
  const { rag } = computeProjectRag({
    contractValue: project.contractValue,
    budgetEntries: budgetEntriesFromSprints(toSprintsForBudget(sprints), project.plannedStoryPoints),
    risks,
  });

  // Next not-yet-done milestone by Planned Date — same definition as
  // lib/portfolio-data.ts's nextMilestone, kept local rather than shared.
  const upcomingMilestones = milestones
    .filter((m) => m.checklistItem.status !== "COMPLETED" && m.checklistItem.status !== "NOT_APPLICABLE" && m.checklistItem.plannedDate)
    .sort((a, b) => a.checklistItem.plannedDate!.getTime() - b.checklistItem.plannedDate!.getTime());
  const nextMilestone = upcomingMilestones[0]
    ? { name: upcomingMilestones[0].checklistItem.milestoneName ?? upcomingMilestones[0].checklistItem.itemText, date: upcomingMilestones[0].checklistItem.plannedDate as Date }
    : null;

  const activeCRValue = crs
    .filter((c) => c.status === "Approved" || c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  const notInvoiced = milestones.filter((m) => m.invoiceStatus === "Not Invoiced" && m.checklistItem.actualDate);
  const nextPaymentDue = notInvoiced.length
    ? notInvoiced.reduce((min, m) => {
        const d = m.checklistItem.actualDate!;
        return !min || d < min ? d : min;
      }, null as Date | null)
    : null;

  const totalAllocatedPct = milestones.reduce((sum, m) => sum + m.paymentPct, 0);
  const nextPaymentAmount = nextPaymentDue
    ? notInvoiced
        .filter((m) => m.checklistItem.actualDate?.getTime() === nextPaymentDue.getTime())
        .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0)
    : 0;

  const paidAmount = milestones
    .filter((m) => m.invoiceStatus === "Paid")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);
  const invoicedAmount = milestones
    .filter((m) => m.invoiceStatus === "Invoiced")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);

  return {
    project,
    totalItems,
    completedItems,
    overallPct,
    endDate,
    rag,
    nextMilestone,
    reminders,
    recentDecisions,
    statusBreakdown,
    perChecklistSummary,
    stageSummaryByType,
    timelineStrip,
    milestonesList,
    evmChartData: evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost })),
    financial: {
      latestSpi: latestEvm?.spi ?? null,
      latestCpi: latestEvm?.cpi ?? null,
      // Chronological, nulls dropped — feeds the Latest SPI tile's sparkline.
      // A gap week (no PV yet) just isn't a point, rather than a break in the line.
      spiHistory: evm.map((e) => e.spi).filter((v): v is number => v != null),
      openHighRisks,
      activeCRValue,
      nextPaymentDue,
      nextPaymentAmount,
      totalAllocatedPct,
      contractValue: project.contractValue,
      paidAmount,
      invoicedAmount,
    },
  };
}
