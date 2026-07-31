import { prisma } from "@/lib/prisma";
import { PM_STAGES, DEVOPS_CATEGORIES } from "@/lib/seed-data";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { riskScore, computeEvm, trancheAmount, currentStage, reminderBand } from "@/lib/calculations";

export async function getDashboardData(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const [allItems, risks, crs, budgetEntries, milestones, actionItems, recentDecisionsRaw] = await Promise.all([
    // One query for both checklists (differ only by `type`) instead of two —
    // filtering below preserves the orderBy order within each subset.
    prisma.checklistItem.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.riskItem.findMany({ where: { projectId } }),
    prisma.changeRequest.findMany({ where: { projectId } }),
    prisma.budgetEntry.findMany({ where: { projectId }, orderBy: { weekEnding: "asc" } }),
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

  const pmItems = allItems.filter((i) => i.type === "PM");
  const devopsItems = allItems.filter((i) => i.type === "DEVOPS");
  // N/A items don't count toward completion at all — not the numerator
  // (obviously not completed) and not the denominator either (they're not
  // part of this project's plan, same as if the template item weren't there).
  const applicableItems = allItems.filter((i) => i.status !== "NOT_APPLICABLE");
  const totalItems = applicableItems.length;
  const completedItems = applicableItems.filter((i) => i.status === "COMPLETED").length;
  const overallPct = totalItems ? completedItems / totalItems : 0;

  // Status breakdown stays over ALL items — seeing "N marked Not Applicable"
  // as its own slice is useful; it's only the percentage-complete math above
  // that excludes them.
  const statusBreakdown = ITEM_STATUSES.map((status) => ({
    status,
    count: allItems.filter((i) => i.status === status).length,
  }));

  const perChecklistSummary = [
    { name: "PM Checklist", items: pmItems },
    { name: "DevOps Checklist", items: devopsItems },
  ].map(({ name, items }) => {
    const applicable = items.filter((i) => i.status !== "NOT_APPLICABLE");
    const completed = applicable.filter((i) => i.status === "COMPLETED").length;
    return { name, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0 };
  });

  function stageSummary(items: typeof pmItems, stages: readonly string[]) {
    return stages.map((stage) => {
      const rows = items.filter((i) => i.stage === stage);
      const applicable = rows.filter((i) => i.status !== "NOT_APPLICABLE");
      const completed = applicable.filter((i) => i.status === "COMPLETED").length;
      const plannedDates = applicable.map((r) => r.plannedDate).filter((d): d is Date => d != null);
      const forecastDates = applicable.map((r) => r.forecastDate).filter((d): d is Date => d != null);
      const start = plannedDates.length ? new Date(Math.min(...plannedDates.map((d) => d.getTime()))) : null;
      const end = forecastDates.length ? new Date(Math.max(...forecastDates.map((d) => d.getTime()))) : null;
      return { stage, total: applicable.length, completed, pct: applicable.length ? completed / applicable.length : 0, start, end };
    });
  }

  const pmStageSummary = stageSummary(pmItems, PM_STAGES);
  const devopsStageSummary = stageSummary(devopsItems, DEVOPS_CATEGORIES);

  // Derived, not stored — the current stage (per the resolved PM-Checklist-
  // is-canonical definition, same as the Projects list) and the project's
  // "end date" (latest Forecast Date across every checklist item), so
  // neither can drift out of sync with the checklist itself.
  const pmStage = currentStage(pmItems, PM_STAGES) ?? "Complete";
  const endDate = applicableItems.reduce<Date | null>((latest, i) => {
    if (!i.forecastDate) return latest;
    return !latest || i.forecastDate > latest ? i.forecastDate : latest;
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
      route: i.type === "PM" ? "pm-checklist" : "devops-checklist",
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

  const timelineStrip = [
    ...pmStageSummary.map((s) => ({ ...s, source: "PM Checklist" })),
    ...devopsStageSummary.map((s) => ({ ...s, source: "DevOps Checklist" })),
  ];

  const milestonesList = milestones
    .map((m) => ({
      id: m.id,
      source: m.checklistItem.type === "PM" ? "PM Checklist" : "DevOps Checklist",
      stage: m.checklistItem.stage,
      milestoneName: m.checklistItem.milestoneName ?? "",
      forecastDate: m.checklistItem.forecastDate,
      status: m.checklistItem.status as ItemStatus,
      order: m.checklistItem.order,
      type: m.checklistItem.type,
    }))
    .sort((a, b) => (a.type === b.type ? a.order - b.order : a.type === "PM" ? -1 : 1));

  const evm = computeEvm(budgetEntries, project.contractValue);
  const latestEvm = [...evm].reverse().find((e) => e.spi != null || e.cpi != null) ?? null;

  const openHighRisks = risks.filter(
    (r) => r.type === "Risk" && r.status !== "Closed" && r.status !== "Mitigated" && riskScore(r.probability, r.impact) >= 6
  ).length;

  const activeCRValue = crs
    .filter((c) => c.status === "Approved" || c.status === "In Progress")
    .reduce((sum, c) => sum + (c.billableManDays ?? 0), 0);

  const notInvoiced = milestones.filter((m) => m.invoiceStatus === "Not Invoiced" && m.checklistItem.forecastDate);
  const nextPaymentDue = notInvoiced.length
    ? notInvoiced.reduce((min, m) => {
        const d = m.checklistItem.forecastDate!;
        return !min || d < min ? d : min;
      }, null as Date | null)
    : null;

  const totalAllocatedPct = milestones.reduce((sum, m) => sum + m.paymentPct, 0);
  const nextPaymentAmount = nextPaymentDue
    ? notInvoiced
        .filter((m) => m.checklistItem.forecastDate?.getTime() === nextPaymentDue.getTime())
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
    pmStage,
    endDate,
    reminders,
    recentDecisions,
    statusBreakdown,
    perChecklistSummary,
    pmStageSummary,
    devopsStageSummary,
    timelineStrip,
    milestonesList,
    evmChartData: evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost })),
    financial: {
      latestSpi: latestEvm?.spi ?? null,
      latestCpi: latestEvm?.cpi ?? null,
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
