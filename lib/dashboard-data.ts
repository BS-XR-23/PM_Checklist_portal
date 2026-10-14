import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { computeProjectHealth, deliveryIndices, deliveryPct, governancePct, wbsBaselinePoints } from "@/lib/project-health";
import { summarizeMilestones, milestoneDueDate, isMilestoneDone } from "@/lib/milestones";
import { PM_STAGES } from "@/lib/seed-data";
import {
  COMPLETED_STAGE_LABEL,
  computeEvm,
  currentStage,
  isTrackedChecklistItem,
  reminderBand,
  budgetEntriesFromSprints,
  sprintTotalsFor,
  toSprintsForBudget,
} from "@/lib/calculations";

const DAY_MS = 86_400_000;

/** A data-quality problem the PM can fix — shown in the Dashboard's attention panel. */
export type DashboardWarning = { tone: "red" | "amber"; text: string; route: string };

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
      route: "decisions#action-items",
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
    }));

  const reminders = [...checklistReminders, ...actionItemReminders].sort((a, b) =>
    a.band !== b.band ? (a.band === "OVERDUE" ? -1 : 1) : a.plannedDate.getTime() - b.plannedDate.getTime()
  );

  // PM Plan's Timeline section (project phases, distinct from the
  // checklist-stage table) — reused here so the
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
  // Budget Burn chart only (Detailed Reporting, Super Admin) — dollar
  // PV/EV/AC against the WBS story-point baseline. Health never reads dollar
  // CPI. Points dated after today (running/draft sprints' end dates) are
  // dropped so the chart never plots the future.
  const now = new Date();
  const evm = computeEvm(budgetEntriesFromSprints(sprintsForBudget, wbsBaselinePoints(wbsTasks)), project.contractValue).filter(
    (e) => e.weekEnding.getTime() <= now.getTime()
  );

  // Where the project is in the PM checklist's stage sequence — the same
  // "first stage with unfinished tracked work" rule the Projects list and
  // Portfolio use. Stages with no items on this project (e.g. Presales on a
  // project not won from a deal) aren't counted as steps.
  const pmItems = allItems.filter((i) => i.type === "PM");
  const stageSteps = PM_STAGES.filter((st) => pmItems.some((i) => i.stage === st && isTrackedChecklistItem(i)));
  const stageLabel = currentStage(pmItems, PM_STAGES) ?? COMPLETED_STAGE_LABEL;
  const stage = { label: stageLabel, step: stageSteps.indexOf(stageLabel as (typeof stageSteps)[number]) + 1, of: stageSteps.length };

  // The sprint the team is in now (started, not closed), else the next
  // draft — Delivery's live heartbeat, which SPI only reflects at close.
  const running = sprints.find((sp) => sp.startedAt && !sp.closedAt);
  const nextDraft = sprints.find((sp) => !sp.startedAt && !sp.closedAt);
  const currentSprint = running
    ? (() => {
        const t = sprintTotalsFor(sprintsForBudget[sprints.indexOf(running)]);
        return {
          state: "RUNNING" as const,
          name: running.name,
          startDate: running.startDate,
          endDate: running.endDate,
          plannedPoints: t.plannedValue,
          earnedPoints: t.earnedValue,
          tasks: running.tasks.length,
          doneTasks: running.tasks.filter((tk) => tk.pctComplete >= 1).length,
          daysLeft: Math.ceil((running.endDate.getTime() - now.getTime()) / DAY_MS),
        };
      })()
    : nextDraft
      ? { state: "NEXT" as const, name: nextDraft.name, startDate: nextDraft.startDate, endDate: nextDraft.endDate, tasks: nextDraft.tasks.length }
      : null;

  const totalPoints = wbsBaselinePoints(wbsTasks);
  const donePoints = wbsTasks.reduce((sum, t) => sum + t.storyPoints * Math.min(t.pctComplete, 1), 0);

  // Same health definition as Delivery/Projects/Portfolio (lib/project-health.ts).
  const health = computeProjectHealth({
    sprints: sprintsForBudget,
    risks,
    milestones,
  });
  const { spiHistory, running: runningSprint } = deliveryIndices(sprintsForBudget);
  const { rag, openHighRisks } = health;


  const activeCRValue = crs
    .filter((c) => c.status === "Approved" || c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  const { nextMilestone, overdue: overdueMilestones, plannedEnd, nextPayment, paidAmount, invoicedAmount, totalAllocatedPct } =
    milestoneSummary;

  // Contract value split for the money bar: collected · invoiced awaiting
  // payment · on a milestone but not invoiced · not on any milestone.
  const allocatedValue = project.contractValue * Math.min(1, totalAllocatedPct);
  const money = {
    contractValue: project.contractValue,
    collected: paidAmount,
    awaiting: invoicedAmount,
    scheduled: Math.max(0, allocatedValue - paidAmount - invoicedAmount),
    unallocated: Math.max(0, project.contractValue - allocatedValue),
  };

  // Data-quality problems that make other figures on this page wrong or
  // blank — each links to where it's fixed.
  const warnings: DashboardWarning[] = [];
  if (milestones.length === 0) {
    warnings.push({ tone: "amber", text: "No client milestones yet — Planned End, Next Milestone and payments stay blank until they're added.", route: "milestones" });
  }
  for (const m of milestones) {
    const billed = m.payment && m.payment.invoiceStatus !== "Not Invoiced";
    if (billed && !isMilestoneDone(m)) {
      warnings.push({ tone: "red", text: `"${m.name}" is ${m.payment!.invoiceStatus.toLowerCase()} but still marked ${m.status === "NOT_STARTED" ? "Not Started" : "not completed"} — update its status.`, route: "milestones" });
    }
  }
  const undated = milestones.filter((m) => !isMilestoneDone(m) && !milestoneDueDate(m));
  if (undated.length) {
    warnings.push({ tone: "amber", text: `${undated.length} milestone${undated.length > 1 ? "s have" : " has"} no date (${undated.map((m) => `"${m.name}"`).slice(0, 3).join(", ")}).`, route: "milestones" });
  }
  if (project.contractValue > 0 && totalAllocatedPct < 0.9999 && milestones.length > 0) {
    warnings.push({
      tone: "amber",
      text: `${Math.round((1 - totalAllocatedPct) * 100)}% of the contract isn't assigned to any milestone payment.`,
      route: "milestones",
    });
  } else if (totalAllocatedPct > 1.0001) {
    warnings.push({ tone: "red", text: `Milestone payments add up to ${Math.round(totalAllocatedPct * 100)}% of the contract — more than 100%.`, route: "milestones" });
  }
  if (openHighRisks > 0) {
    warnings.push({ tone: "red", text: `${openHighRisks} open high-severity risk${openHighRisks > 1 ? "s" : ""} — mitigate or close ${openHighRisks > 1 ? "them" : "it"} to clear Critical health.`, route: "risks" });
  }

  return {
    project,
    totalItems,
    completedItems,
    overallPct,
    deliveryPct: deliveryPctValue,
    totalPoints,
    donePoints,
    stage,
    currentSprint,
    money,
    warnings,
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
    projectGanttRows,
    milestonesList,
    evmChartData: evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost })),
    financial: {
      latestSpi: health.spi,
      effortIndex: health.effortIndex,
      // Chronological cumulative SPI after each sprint — feeds the SPI tile's sparkline.
      spiHistory: spiHistory.map((h) => h.spi),
      // The running sprint isn't in SPI until it closes — shown beside it.
      runningSprint,
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
