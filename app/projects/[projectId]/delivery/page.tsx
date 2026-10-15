import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { toSprintsForBudget, sprintTotalsFor } from "@/lib/calculations";
import { computeProjectHealth, deliveryIndices } from "@/lib/project-health";
import { summarizeMilestones } from "@/lib/milestones";
import { scopeBreakdown, paceForecast, pickReleases } from "@/lib/delivery-forecast";
import { PageGuide } from "@/components/ui/page-guide";
import { formatDate, formatPct } from "@/lib/format";
import { RAG_COLORS, RAG_LABELS } from "@/lib/rag";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const pts = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");

/**
 * Delivery at a glance: how much of the scope is done and where the rest
 * sits, when it finishes at the pace closed sprints actually delivered
 * (against the client milestone plan), the sprint in flight, and the
 * milestone / release / UAT picture. Everything is read from its own tab.
 */
export default async function DeliveryOverviewPage({ params }: { params: { projectId: string } }) {
  const [, riskAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
  ]);
  const projectId = params.projectId;

  const [wbsTasks, sprints, milestones, releases, uatCases, uatDefects, risks, dependencies] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId }, select: { storyPoints: true, pctComplete: true, sprintId: true } }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: "asc" },
      include: { tasks: { include: { person: { include: { roleRate: true } } } } },
      relationLoadStrategy: "join",
    }),
    // The project's one milestone list (Milestones & Payments) — the same
    // rows Dashboard, Portfolio and health read.
    prisma.milestone.findMany({ where: { projectId } }),
    prisma.release.findMany({ where: { projectId } }),
    prisma.uatCase.findMany({ where: { projectId }, select: { status: true } }),
    prisma.uatDefect.findMany({ where: { projectId }, select: { status: true, severity: true } }),
    // Health inputs — same sources Dashboard/Portfolio feed computeProjectHealth.
    prisma.riskItem.findMany({ where: { projectId }, select: { type: true, status: true, probability: true, impact: true } }),
    prisma.dependencyItem.findMany({ where: { projectId, status: { not: "Done" } }, select: { status: true, priority: true, expectedDate: true } }),
  ]);

  const today = new Date();
  const sprintsForBudget = toSprintsForBudget(sprints);
  const { spi, effortIndex, scheduleVariancePts } = deliveryIndices(sprintsForBudget);
  const health = computeProjectHealth({ sprints: sprintsForBudget, risks, milestones, dependencies, today });

  // --- Scope and pace ---
  const scope = scopeBreakdown(wbsTasks, sprints);
  const closedSprints = sprints
    .map((s, i) => ({ s, totals: sprintTotalsFor(sprintsForBudget[i]) }))
    .filter(({ s }) => s.closedAt)
    .map(({ s, totals }) => ({ startDate: s.startDate, endDate: s.endDate, earnedPoints: totals.earnedValue }));
  const forecast = paceForecast(closedSprints, scope.total - scope.done, today);
  const milestoneSummary = summarizeMilestones(
    milestones.map((m) => ({ ...m, payment: null })),
    0,
    today
  );
  const plannedEnd = milestoneSummary.plannedEnd;
  const slipDays = forecast && plannedEnd ? Math.round((forecast.finish.getTime() - plannedEnd.getTime()) / DAY_MS) : null;

  // --- Current sprint: the running one, else the next draft ---
  const runningIdx = sprints.findIndex((s) => s.startedAt && !s.closedAt);
  const nextIdx = sprints.findIndex((s) => !s.startedAt && !s.closedAt);
  const currentIdx = runningIdx >= 0 ? runningIdx : nextIdx;
  const currentSprint = currentIdx >= 0 ? sprints[currentIdx] : null;
  const currentTotals = currentIdx >= 0 ? sprintTotalsFor(sprintsForBudget[currentIdx]) : null;
  const followingSprint = runningIdx >= 0 && nextIdx >= 0 ? sprints[nextIdx] : null;
  const daysLeft = currentSprint ? Math.ceil((currentSprint.endDate.getTime() - new Date(today).setHours(0, 0, 0, 0)) / DAY_MS) : null;

  // --- Releases and UAT ---
  const { latestDeployed, next: nextRelease, signoffFrom } = pickReleases(releases);
  const failedRecently = releases.some((r) => r.deploymentStatus === "Failed" || r.deploymentStatus === "Rolled Back");
  const passedCases = uatCases.filter((c) => c.status === "PASSED").length;
  const failedCases = uatCases.filter((c) => c.status === "FAILED" || c.status === "BLOCKED").length;
  const openDefects = uatDefects.filter((d) => d.status !== "Closed" && d.status !== "Rejected");
  const criticalDefects = openDefects.filter((d) => d.severity === "Critical").length;

  const rag = RAG_COLORS[health.rag];
  const segments = [
    { label: "Done", value: scope.done, tasks: scope.tasks.done, color: "#16A34A" },
    { label: currentSprint && runningIdx >= 0 ? `In ${currentSprint.name} (running)` : "In the running sprint", value: scope.inCurrentSprint, tasks: scope.tasks.inCurrentSprint, color: "#3B82F6" },
    { label: "Planned in later sprints", value: scope.plannedLater, tasks: scope.tasks.plannedLater, color: "#93C5FD" },
    { label: "Not in any upcoming sprint", value: scope.backlog, tasks: scope.tasks.backlog, color: "#E2E8F0" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery overview</h2>
          <p className="text-sm text-slate-500">How much is done, when the rest finishes at the current pace, and what&apos;s in flight. Read from Tasks, Sprints, Milestones, Releases and UAT.</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: rag.bg, color: rag.text }}
          title={riskAccess !== "NONE" && health.reasons.length ? health.reasons.join(" · ") : undefined}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rag.text }} />
          Health: {RAG_LABELS[health.rag]}
          {riskAccess !== "NONE" && health.reasons.length > 0 && <span className="font-normal">· {health.reasons.join(" · ")}</span>}
        </span>
      </div>

      <PageGuide
        id="delivery-overview"
        title="How to read this page"
        points={[
          <><strong>Scope</strong> is every WBS task&apos;s story points. Partly finished tasks count in proportion. Tasks in a sprint that hasn&apos;t started count as planned, not in progress.</>,
          <><strong>Finish forecast</strong> = points left ÷ the pace closed sprints delivered (points per calendar day). It&apos;s compared with the <strong>planned end</strong> — the last client milestone date, the same one the Dashboard shows. With only one or two closed sprints it&apos;s rough.</>,
          <><strong>SPI</strong> and <strong>Effort Index</strong> use closed sprints only; a running sprint joins when it closes. Health is the same rating as the Dashboard and Portfolio.</>,
        ]}
      />

      {/* Scope */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Scope</p>
          <Link href={`/projects/${projectId}/delivery/tasks`} className="text-xs font-medium text-indigo-600 hover:underline">
            Tasks →
          </Link>
        </div>
        {scope.total > 0 ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              <span className="text-2xl font-bold text-slate-900">{formatPct(scope.done / scope.total)}</span>{" "}
              <span className="ml-1">
                {pts(scope.done)} of {pts(scope.total)} story points done · {wbsTasks.length} tasks
              </span>
            </p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {segments.map((sg) =>
                sg.value > 0 ? <div key={sg.label} style={{ width: `${(sg.value / scope.total) * 100}%`, backgroundColor: sg.color }} title={`${sg.label}: ${pts(sg.value)} pts`} /> : null
              )}
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {segments.map((sg) => (
                <li key={sg.label} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sg.color }} />
                    {sg.label}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {pts(sg.value)} pts <span className="font-normal text-slate-400">· {sg.tasks} task{sg.tasks === 1 ? "" : "s"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-400">No WBS tasks yet — upload or add them on the Tasks tab.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Finish forecast */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">When will it finish?</p>
          {forecast ? (
            <>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {forecast.remaining > 0 ? `~${formatDate(forecast.finish)}` : "All points done"}
              </p>
              <p className="text-xs text-slate-500">
                {pts(forecast.remaining)} pts left at ~{pts(forecast.pointsPerWeek)} pts/week — the pace of {forecast.basedOnSprints} closed sprint{forecast.basedOnSprints === 1 ? "" : "s"}
                {forecast.basedOnSprints < 3 ? " (rough until a few more close)" : ""}.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">{scope.total > 0 ? "No forecast until a sprint closes with points earned." : "Add WBS tasks and run a sprint to get a forecast."}</p>
          )}

          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
            <Row label="Planned end (last client milestone)" value={plannedEnd ? formatDate(plannedEnd) : null} empty="No dated client milestone" href={`/projects/${projectId}/milestones`} />
            {slipDays != null && forecast && forecast.remaining > 0 && (
              <p className={clsx("rounded-md px-2 py-1 text-xs font-medium", slipDays > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>
                {slipDays > 0
                  ? `At this pace the work finishes about ${Math.round(slipDays / 7)} week${Math.round(slipDays / 7) === 1 ? "" : "s"} (${slipDays} days) after the planned end.`
                  : `On track to finish ${-slipDays} day${slipDays === -1 ? "" : "s"} before the planned end.`}
              </p>
            )}
            <Row label="SPI (closed sprints)" value={spi != null ? spi.toFixed(2) : null} empty="No closed sprint yet" tone={spi != null && spi < 0.9 ? "red" : spi != null && spi < 1 ? "amber" : undefined} />
            <Row label="Effort Index" value={effortIndex != null ? effortIndex.toFixed(2) : null} empty="—" />
            {closedSprints.length > 0 && <Row label="Schedule variance" value={`${scheduleVariancePts >= 0 ? "+" : ""}${pts(scheduleVariancePts)} pts`} empty="—" tone={scheduleVariancePts < 0 ? "amber" : undefined} />}
          </div>
        </section>

        {/* Current sprint */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{runningIdx >= 0 ? "Current sprint" : "Next sprint"}</p>
            <Link href={`/projects/${projectId}/delivery/sprints`} className="text-xs font-medium text-indigo-600 hover:underline">
              Sprints →
            </Link>
          </div>
          {currentSprint && currentTotals ? (
            <>
              <p className="mt-1 text-2xl font-bold text-slate-900">{currentSprint.name}</p>
              <p className="text-xs text-slate-500">
                {formatDate(currentSprint.startDate)} – {formatDate(currentSprint.endDate)}
                {runningIdx >= 0 && daysLeft != null && (daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ` · ended ${-daysLeft} day${daysLeft === -1 ? "" : "s"} ago — close it`)}
                {runningIdx < 0 && " · not started"}
              </p>
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-xs text-slate-600">
                  <span>
                    {pts(currentTotals.earnedValue)} of {pts(currentTotals.plannedValue)} pts earned
                  </span>
                  <span className="font-semibold">{currentTotals.plannedValue ? formatPct(currentTotals.earnedValue / currentTotals.plannedValue) : "—"}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${currentTotals.plannedValue ? Math.min(100, (currentTotals.earnedValue / currentTotals.plannedValue) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                <Row label="Tasks in this sprint" value={String(currentSprint.tasks.length)} empty="0" />
                <Row label="Next up" value={followingSprint ? `${followingSprint.name} · ${formatDate(followingSprint.startDate)}` : null} empty="No sprint planned after this" />
                <Row label="Sprints closed" value={String(closedSprints.length)} empty="0" />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">{sprints.length ? "Every sprint is closed — plan the next one on the Sprints tab." : "No sprints yet — plan one on the Sprints tab."}</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <CardHead title="Client milestones" href={`/projects/${projectId}/milestones`} />
          <Row label="Next" value={milestoneSummary.nextMilestone ? `${milestoneSummary.nextMilestone.name} · ${formatDate(milestoneSummary.nextMilestone.date)}` : null} empty="Nothing upcoming with a date" />
          <Row
            label="Overdue"
            value={milestoneSummary.overdue.length ? `${milestoneSummary.overdue.length} — ${milestoneSummary.overdue[0].name}${milestoneSummary.overdue.length > 1 ? " …" : ""}` : "None"}
            empty="None"
            tone={milestoneSummary.overdue.length ? "red" : undefined}
          />
          <Row label="Delivered" value={`${milestones.filter((m) => m.status === "COMPLETED").length} of ${milestones.filter((m) => m.status !== "NOT_APPLICABLE").length}`} empty="—" />
        </section>

        <section className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <CardHead title="Releases" href={`/projects/${projectId}/delivery/releases`} />
          <Row label="Last deployed" value={latestDeployed ? `${latestDeployed.version} — ${latestDeployed.name}${latestDeployed.releaseDate ? ` · ${formatDate(latestDeployed.releaseDate)}` : ""}` : null} empty="Nothing deployed yet" />
          <Row label="Build" value={latestDeployed?.buildNumber ?? null} empty="—" />
          <Row label="Next" value={nextRelease ? `${nextRelease.version} — ${nextRelease.name}${nextRelease.releaseDate ? ` · ${formatDate(nextRelease.releaseDate)}` : " · no date"}` : null} empty="None planned" />
          {failedRecently && <p className="text-xs font-medium text-rose-700">A release failed or was rolled back — check the Releases tab.</p>}
        </section>

        <section className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <CardHead title="UAT" href={`/projects/${projectId}/delivery/uat`} />
          <Row label="Test cases passed" value={uatCases.length ? `${passedCases} of ${uatCases.length} (${formatPct(passedCases / uatCases.length)})` : null} empty="No test cases yet" />
          {failedCases > 0 && <Row label="Failed or blocked" value={String(failedCases)} empty="0" tone="amber" />}
          <Row label="Open defects" value={openDefects.length ? `${openDefects.length}${criticalDefects ? ` · ${criticalDefects} critical` : ""}` : "None"} empty="None" tone={criticalDefects ? "red" : undefined} />
          <Row label="Client sign-off" value={signoffFrom ? `${signoffFrom.uatSignoffStatus} (${signoffFrom.version})` : null} empty="No release to sign off yet" />
        </section>
      </div>
    </div>
  );
}

function CardHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <p className="font-semibold text-slate-900">{title}</p>
      <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">
        View →
      </Link>
    </div>
  );
}

function Row({ label, value, empty, tone, href }: { label: string; value: string | null; empty: string; tone?: "red" | "amber"; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      {value ? (
        <span className={clsx("text-right font-medium", tone === "red" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-slate-800")}>{value}</span>
      ) : href ? (
        <Link href={href} className="text-right text-slate-400 hover:text-indigo-600">
          {empty}
        </Link>
      ) : (
        <span className="text-right text-slate-400">{empty}</span>
      )}
    </div>
  );
}
