import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { toSprintsForBudget, sprintTotalsFor } from "@/lib/calculations";
import { computeProjectHealth, deliveryIndices, deliveryPct } from "@/lib/project-health";
import { isMilestoneDone, milestoneDueDate } from "@/lib/milestones";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { PageGuide } from "@/components/ui/page-guide";
import { formatDate, formatPct } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { MILESTONE_TYPE_LABELS } from "@/lib/constants";
import type { ItemStatus } from "@/lib/constants";
import {
  IconLayers,
  IconClipboardList,
  IconCheckCircle,
  IconClock,
  IconGauge,
  IconTarget,
  IconAlertTriangle,
  IconCalendar,
  IconFolder,
  IconCircle,
} from "@/components/layout/icons";

export const dynamic = "force-dynamic";

export default async function DeliveryOverviewPage({ params }: { params: { projectId: string } }) {
  const [, riskAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
  ]);
  const projectId = params.projectId;

  const [wbsTasks, sprints, milestones, releases, uatCases, uatDefects, risks] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId } }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: "asc" },
      include: { tasks: { include: { person: { include: { roleRate: true } } } } },
      relationLoadStrategy: "join",
    }),
    // The project's one milestone list (Milestones & Payments tab) — the
    // same rows Dashboard, Portfolio, and Health read.
    prisma.milestone.findMany({ where: { projectId }, orderBy: { plannedDate: "asc" } }),
    prisma.release.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.uatCase.findMany({ where: { projectId } }),
    prisma.uatDefect.findMany({ where: { projectId } }),
    // Health inputs — same sources Dashboard/Portfolio feed computeProjectHealth.
    prisma.riskItem.findMany({ where: { projectId }, select: { type: true, status: true, probability: true, impact: true } }),
  ]);

  // --- Execution KPIs: task counts (same derivation as the Tasks tab) ---
  const totalTasks = wbsTasks.length;
  const completedTasks = wbsTasks.filter((t) => t.pctComplete >= 1).length;
  const inProgressTasks = wbsTasks.filter((t) => t.pctComplete < 1 && t.sprintId).length;
  const notStartedTasks = totalTasks - completedTasks - inProgressTasks;
  // Story-point weighted (same as the Tasks tab's Done Points %), not a
  // per-task average — a 0.25-point task no longer counts as much as an
  // 8-point one.
  const deliveryPctValue = deliveryPct(wbsTasks);

  // SPI / Effort Index / health — the shared definitions in
  // lib/project-health.ts, identical to Dashboard, Projects, and Portfolio.
  const sprintsForBudget = toSprintsForBudget(sprints);
  const { spi, effortIndex, scheduleVariancePts } = deliveryIndices(sprintsForBudget);
  const health = computeProjectHealth({ sprints: sprintsForBudget, risks, milestones });

  const currentSprint =
    sprints.find((s) => s.startedAt && !s.closedAt) ??
    sprints.find((s) => !s.startedAt && !s.closedAt) ??
    [...sprints].reverse()[0] ??
    null;
  let currentSprintProgress: number | null = null;
  if (currentSprint) {
    const { plannedValue, earnedValue } = sprintTotalsFor(sprintsForBudget[sprints.indexOf(currentSprint)]);
    currentSprintProgress = plannedValue ? earnedValue / plannedValue : null;
  }

  const plannedStart = sprints.length ? sprints[0].startDate : null;
  const plannedEnd = sprints.length ? sprints.reduce((max, s) => (s.endDate > max ? s.endDate : max), sprints[0].endDate) : null;
  const latestMilestoneForecast = milestones.reduce<Date | null>(
    (max, m) => (m.forecastDate && (!max || m.forecastDate > max) ? m.forecastDate : max),
    null
  );
  const forecastEnd = latestMilestoneForecast && plannedEnd && latestMilestoneForecast > plannedEnd ? latestMilestoneForecast : plannedEnd;

  // --- Milestone summary ---
  // Due date = forecast if re-forecast, else planned — same rule as the
  // Dashboard/Portfolio/Health (lib/milestones.ts).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const currentMilestone =
    milestones.find((m) => m.status === "IN_PROGRESS") ?? milestones.find((m) => !isMilestoneDone(m)) ?? null;
  const upcomingMilestone =
    milestones.find((m) => {
      const due = milestoneDueDate(m);
      return m.id !== currentMilestone?.id && !isMilestoneDone(m) && due != null && due >= startOfToday;
    }) ?? null;
  const delayedMilestones = milestones.filter((m) => {
    const due = milestoneDueDate(m);
    return !isMilestoneDone(m) && (m.status === "DELAYED" || (due != null && due < startOfToday));
  });
  const recentlyCompleted = [...milestones]
    .filter((m) => m.status === "COMPLETED")
    .sort((a, b) => (b.actualDate?.getTime() ?? 0) - (a.actualDate?.getTime() ?? 0))[0];

  // --- Release summary ---
  const latestRelease = releases[0] ?? null; // already ordered by createdAt desc
  const nextPlannedRelease = releases.find((r) => r.deploymentStatus === "Planned") ?? null;

  // --- UAT summary ---
  const totalUatCases = uatCases.length;
  const passedCases = uatCases.filter((c) => c.status === "PASSED").length;
  const uatProgress = totalUatCases ? passedCases / totalUatCases : 0;
  const openDefects = uatDefects.filter((d) => d.status !== "Closed" && d.status !== "Rejected");
  const criticalDefects = openDefects.filter((d) => d.severity === "Critical");
  const latestUatSignoff = releases.find((r) => r.uatSignoffStatus !== "Pending")?.uatSignoffStatus ?? latestRelease?.uatSignoffStatus ?? "Pending";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Overview</h2>
        <p className="text-sm text-slate-500">
          Where the project stands from a delivery perspective — aggregated from Tasks/WBS, Sprints, Milestones,
          Releases, and UAT. Nothing here is tracked independently; every number links back to its source tab.
        </p>
      </div>

      <PageGuide
        id="delivery-overview"
        title="How to read this page"
        points={[
          <>Nothing is entered here — every figure is aggregated live from the Tasks, Sprints, Milestones, Releases, and UAT tabs. To change a number, go edit it at its source.</>,
          <><strong>Health</strong> is the same rating shown on the Dashboard and Portfolio: red for any open high risk or SPI under 0.9, amber for SPI under 1.0 or an overdue milestone, green otherwise.</>,
          <><strong>Effort Index</strong> is story points earned ÷ competency-adjusted man-days spent — above 1.0 means work took less effort than estimated. It measures estimate accuracy and doesn&apos;t affect Health.</>,
          <><strong>Schedule Variance</strong> is EV − PV in story points — negative means the project is behind its plan.</>,
          <>Each summary card (&quot;View all →&quot;) jumps straight to the tab that owns that data.</>,
        ]}
      />

      {/* Overall Delivery */}
      <div>
        <SectionHeader icon={<IconGauge />} iconWrapClass="bg-indigo-50 text-indigo-600" title="Overall Delivery" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
          <StatTile
            icon={<IconTarget />}
            iconWrapClass="bg-indigo-50 text-indigo-600"
            label="Delivery %"
            value={deliveryPctValue != null ? formatPct(deliveryPctValue) : "—"}
            subtitle="Story points done of total WBS"
          />
          <StatTile icon={<IconCalendar />} iconWrapClass="bg-slate-100 text-slate-500" label="Planned Start" value={formatDate(plannedStart)} />
          <StatTile icon={<IconCalendar />} iconWrapClass="bg-slate-100 text-slate-500" label="Planned End" value={formatDate(plannedEnd)} />
          <StatTile
            icon={<IconCalendar />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Forecast End"
            value={formatDate(forecastEnd)}
          />
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Schedule Variance"
            value={`${scheduleVariancePts >= 0 ? "+" : ""}${scheduleVariancePts.toFixed(1)} pts`}
            subtitle="EV − PV, story points"
          />
          <StatTile
            icon={<IconLayers />}
            iconWrapClass="bg-violet-50 text-violet-600"
            label="Current Sprint"
            value={currentSprint?.name ?? "—"}
            subtitle={
              currentSprint
                ? currentSprint.closedAt
                  ? "Closed"
                  : currentSprint.startedAt
                    ? "Open"
                    : "Draft"
                : "No sprints yet"
            }
          />
          <StatTile
            icon={<IconFolder />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="Current Milestone"
            value={currentMilestone?.name ?? "—"}
            subtitle={currentMilestone ? MILESTONE_TYPE_LABELS[currentMilestone.type] : undefined}
          />
          <StatTile
            icon={<IconGauge />}
            iconWrapClass="bg-slate-100"
            label="Health"
            value={RAG_COLORS[health.rag].label}
            valueColor={RAG_COLORS[health.rag].text}
            accentColor={RAG_COLORS[health.rag].bg}
            // Reasons can cite open-risk counts — only for viewers who can see the Risk Register.
            subtitle={riskAccess !== "NONE" ? health.reasons.join(" · ") || "No issues found" : undefined}
          />
        </div>
      </div>

      {/* Execution KPIs */}
      <div>
        <SectionHeader icon={<IconClipboardList />} iconWrapClass="bg-blue-50 text-blue-600" title="Execution KPIs" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile icon={<IconClipboardList />} iconWrapClass="bg-violet-50 text-violet-600" label="Total WBS Tasks" value={String(totalTasks)} />
          <StatTile
            icon={<IconCheckCircle />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Completed"
            value={String(completedTasks)}
            subtitle={totalTasks ? formatPct(completedTasks / totalTasks) : undefined}
          />
          <StatTile
            icon={<IconClock />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="In Progress"
            value={String(inProgressTasks)}
            subtitle={totalTasks ? formatPct(inProgressTasks / totalTasks) : undefined}
          />
          <StatTile icon={<IconCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Not Started" value={String(notStartedTasks)} />
          <StatTile
            icon={<IconGauge />}
            iconWrapClass="bg-indigo-50 text-indigo-600"
            label="Current Sprint Progress"
            value={currentSprintProgress != null ? formatPct(currentSprintProgress) : "—"}
          />
          <StatTile
            icon={<IconGauge />}
            iconWrapClass={spi != null && spi < 0.9 ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}
            label="SPI"
            value={spi != null ? spi.toFixed(2) : "—"}
          />
          <StatTile
            icon={<IconGauge />}
            iconWrapClass={effortIndex != null && effortIndex < 0.9 ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}
            label="Effort Index"
            value={effortIndex != null ? effortIndex.toFixed(2) : "—"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Milestone Summary */}
        <div>
          <SectionHeader icon={<IconFolder />} iconWrapClass="bg-blue-50 text-blue-600" title="Milestone Summary" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <SummaryRow label="Current" value={currentMilestone?.name} status={currentMilestone?.status as ItemStatus | undefined} />
            <SummaryRow label="Upcoming" value={upcomingMilestone?.name} date={upcomingMilestone ? milestoneDueDate(upcomingMilestone) : null} />
            <SummaryRow label="Delayed" value={delayedMilestones.length ? `${delayedMilestones.length} milestone(s)` : "None"} />
            <SummaryRow label="Recently Completed" value={recentlyCompleted?.name} date={recentlyCompleted?.actualDate ?? null} />
            <Link href={`/projects/${projectId}/milestones`} className="text-xs font-medium text-indigo-600 hover:underline block pt-1">
              View all milestones →
            </Link>
          </div>
        </div>

        {/* Release Summary */}
        <div>
          <SectionHeader icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" title="Release Summary" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <SummaryRow label="Latest Release" value={latestRelease ? `${latestRelease.version} — ${latestRelease.name}` : undefined} />
            <SummaryRow label="Current Build" value={latestRelease?.buildNumber ?? undefined} />
            <SummaryRow label="Next Planned" value={nextPlannedRelease ? `${nextPlannedRelease.version} — ${nextPlannedRelease.name}` : undefined} date={nextPlannedRelease?.releaseDate ?? null} />
            <SummaryRow label="Status" value={latestRelease?.deploymentStatus} />
            <Link href={`/projects/${projectId}/delivery/releases`} className="text-xs font-medium text-indigo-600 hover:underline block pt-1">
              View all releases →
            </Link>
          </div>
        </div>

        {/* UAT Summary */}
        <div>
          <SectionHeader icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" title="UAT Summary" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <SummaryRow label="Progress" value={totalUatCases ? `${passedCases}/${totalUatCases} passed (${formatPct(uatProgress)})` : "No test cases yet"} />
            <SummaryRow label="Open Defects" value={String(openDefects.length)} />
            <SummaryRow label="Critical Defects" value={String(criticalDefects.length)} highlight={criticalDefects.length > 0} />
            <SummaryRow label="Sign-off Status" value={latestUatSignoff} />
            <Link href={`/projects/${projectId}/delivery/uat`} className="text-xs font-medium text-indigo-600 hover:underline block pt-1">
              View UAT →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  status,
  date,
  highlight,
}: {
  label: string;
  value?: string | null;
  status?: ItemStatus;
  date?: Date | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="text-right">
        <span className={highlight ? "font-semibold text-rose-600" : "font-medium text-slate-800"}>{value ?? "—"}</span>
        {status && (
          <div className="mt-0.5">
            <StatusBadge status={status} />
          </div>
        )}
        {date !== undefined && date && <p className="text-xs text-slate-400 mt-0.5">{formatDate(date)}</p>}
      </div>
    </div>
  );
}
