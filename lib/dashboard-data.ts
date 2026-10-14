import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { computeProjectHealth, deliveryIndices, deliveryPct, governancePct, wbsBaselinePoints } from "@/lib/project-health";
import { summarizeMilestones, milestoneDueDate } from "@/lib/milestones";
import {
  computeEvm,
  isTrackedChecklistItem,
  reminderBand,
  budgetEntriesFromSprints,
  toSprintsForBudget,
} from "@/lib/calculations";

export async function getDashboardData(projectId: string) {
  const [project, allItems, risks, crs, sprints, milestones, actionItems, recentDecisionsRaw, pmPlan, wbsTasks] = await Promise.all([
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
    prisma.milestone.findMany({
      where: { projectId },
      include: { payment: true, ownerPerson: { select: { name: true } } },
      orderBy: [{ plannedDate: { sort: "asc", nulls: "last" } }, { order: "asc" }],
    }),
    prisma.actionItem.findMany({ where: { projectId, dueDate: { not: null } }, include: { ownerPerson: { select: { name: true } } } }),
    prisma.decisionLogItem.findMany({ where: { projectId }, orderBy: { order: "desc" }, take: 5, include: { decidedByPerson: { select: { name: true } } } }),
    prisma.pMPlan.findUnique({ where: { projectId }, select: { timelineRows: { orderBy: { order: "asc" } } } }),
    prisma.wbsTask.findMany({ where: { projectId }, select: { storyPoints: true, pctComplete: true } }),
  ]);

  const recentDecisions = recentDecisionsRaw.map((d) => ({
    id: d.id,
    decision: d.decision,
    date: d.date,
    decidedByName: d.decidedByPerson?.name ?? d.decidedBy ?? null,
  }));

  // N/A and recurring cadence items don't count toward completion at all —
  // see isTrackedChecklistItem (lib/calculations.ts).
  const applicableItems = allItems.filter(isTrackedChecklistItem);
  const totalItems = applicableItems.length;
  const completedItems = applicableItems.filter((i) => i.status === "COMPLETED").length;
  const overallPct = governancePct(allItems);
  const deliveryPctValue = deliveryPct(wbsTasks);

  // Status breakdown keeps Not Applicable as its own slice — seeing "N
  // marked N/A" is useful; only the percentage-complete math above excludes
  // them. Recurring cadence items are left out here too: they have no
  // one-off status to report and live in their own "Ongoing cadence" block,
  // so counting them made Not Started exceed Total Items.
  const oneOffItems = allItems.filter((i) => !i.isRecurring);
  const statusBreakdown = ITEM_STATUSES.map((status) => ({
    status,
    count: oneOffItems.filter((i) => i.status === status).length,
  }));

  // Checklist types this project has no items in at all (e.g. a project that
  // never turned on Engineering/QA/Dev checklists) are dropped rather than
  // shown as a permanent 0/0 row — dead rows were the biggest source of
  // "disorganized" scroll depth on this page.
  const perChecklistSummary = CHECKLIST_TYPES.map((c) => {
    const items = allItems.filter((i) => i.type === c.key);
    const applicable = items.filter(isTrackedChecklistItem);
    const completed = applicable.filter((i) => i.status === "COMPLETED").length;
    return { name: c.label, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0 };
  }).filter((c) => c.total > 0);

  function stageSummary(items: typeof allItems, stages: readonly string[]) {
    return stages.map((stage) => {
      const rows = items.filter((i) => i.stage === stage);
      const applicable = rows.filter(isTrackedChecklistItem);
      const completed = applicable.filter((i) => i.status === "COMPLETED").length;
      const plannedDates = applicable.map((r) => r.plannedDate).filter((d): d is Date => d != null);
      const actualDates = applicable.map((r) => r.actualDate).filter((d): d is Date => d != null);
      const start = plannedDates.length ? new Date(Math.min(...plannedDates.map((d) => d.getTime()))) : null;
      const end = actualDates.length ? new Date(Math.max(...actualDates.map((d) => d.getTime()))) : null;
      return { stage, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0, start, end };
    });
  }

  // One stage/category breakdown per checklist type, in registry order.
  // Stages with zero items for this project (e.g. Architecture/Code Review/
  // Performance/Technical QA on a project that's only used Engineering's
  // "Development" stage so far, or "Presales" on anything not won from a
  // Presales opportunity — see winPresalesProject, app/presales/actions.ts)
  // are dropped rather than shown as a permanent "0/0 (0%)" row — dead rows
  // were the biggest source of scroll depth on this section.
  const stageSummaryByType = CHECKLIST_TYPES.map((c) => {
    const items = allItems.filter((i) => i.type === c.key);
    const stages = stageSummary(items, c.stageOrder).filter((s) => s.total > 0);
    return { key: c.key, label: c.label, stageLabel: c.stageLabel, stages };
  }).filter((c) => c.stages.length > 0);


  // Same reminder-worthy definition as lib/notifications.ts (cross-project
  // sidebar/notifications page) — computed here for free since allItems is
  // already loaded, no extra query for the checklist half. band is non-null
  // here by construction (reminderBand only returns null when plannedDate
  // is null or the item's done), so plannedDate is guaranteed non-null too.
  const checklistReminders = allItems
    .filter((i) => !i.isRecurring) // cadence items have no single due date to be overdue against
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

  // PM Plan's Timeline section (project phases, distinct from the
  // checklist-stage-level timelineStrip above) — reused here so the
  // dashboard has a project-level Gantt, not just the PM/DevOps checklist
  // planned-vs-actual strip.
  const projectGanttRows = (pmPlan?.timelineRows ?? [])
    .map((t) => ({ id: t.id, label: t.phase, start: parseDateInput(t.start), end: parseDateInput(t.end), status: t.status }))
    .filter((t): t is { id: string; label: string; start: Date; end: Date; status: string } => t.start !== null && t.end !== null);

  // Client-facing milestones (Milestones & Payments tab) — the one list the
  // Dashboard reads for Key Milestones, Next Milestone, Planned End, and
  // payments. Checklist gates are not milestones.
  const milestonesList = milestones.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    dueDate: milestoneDueDate(m),
    actualDate: m.actualDate,
    status: m.status as ItemStatus,
  }));
  const milestoneSummary = summarizeMilestones(
    milestones.map((m) => ({ ...m, ownerName: m.ownerPerson?.name ?? null })),
    project.contractValue
  );

  const sprintsForBudget = toSprintsForBudget(sprints);
  // Budget Burn chart only (Detailed Reporting) — dollar PV/EV/AC against
  // the WBS story-point baseline. Health below never reads dollar CPI.
  const evm = computeEvm(budgetEntriesFromSprints(sprintsForBudget, wbsBaselinePoints(wbsTasks)), project.contractValue);

  // Same health definition as Delivery/Projects/Portfolio (lib/project-health.ts).
  const health = computeProjectHealth({
    sprints: sprintsForBudget,
    risks,
    milestones,
  });
  const { spiHistory } = deliveryIndices(sprintsForBudget);
  const { rag, openHighRisks } = health;


  const activeCRValue = crs
    .filter((c) => c.status === "Approved" || c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  const { nextMilestone, overdue: overdueMilestones, plannedEnd, nextPayment, paidAmount, invoicedAmount, totalAllocatedPct } =
    milestoneSummary;

  return {
    project,
    totalItems,
    completedItems,
    overallPct,
    deliveryPct: deliveryPctValue,
    plannedEnd,
    overdueMilestones,
    rag,
    healthReasons: health.reasons,
    nextMilestone,
    reminders,
    recentDecisions,
    statusBreakdown,
    perChecklistSummary,
    stageSummaryByType,
    timelineStrip,
    projectGanttRows,
    milestonesList,
    evmChartData: evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost })),
    financial: {
      latestSpi: health.spi,
      effortIndex: health.effortIndex,
      // Chronological cumulative SPI after each sprint — feeds the SPI tile's sparkline.
      spiHistory: spiHistory.map((h) => h.spi),
      openHighRisks,
      activeCRValue,
      nextPayment,
      totalAllocatedPct,
      contractValue: project.contractValue,
      paidAmount,
      invoicedAmount,
    },
  };
}
