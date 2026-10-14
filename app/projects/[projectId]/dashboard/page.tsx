import Link from "next/link";
import clsx from "clsx";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatPct, formatMoney, formatDate, formatShortDate } from "@/lib/format";
import { RISK_SEVERITY_COLORS, INDEX_BAND_COLORS, indexBand } from "@/lib/colors";
import { RAG_COLORS, RAG_LABELS } from "@/lib/rag";
import { requireModuleAccess, getModuleAccess, requireUser } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { IconShield, IconLayers, IconDollar, IconBell, IconBadge, IconTarget, IconCheckCircle, IconGauge } from "@/components/layout/icons";
import { SpiSparkline } from "@/components/charts/spi-sparkline";
import { DeliveryProgressGauge } from "@/components/charts/delivery-progress-gauge";
import { DetailedReporting } from "./detailed-reporting";

// Order is by question, most urgent first: Where are we? (status strip) ·
// What needs me? (attention) · How far along? (progress) · Money ·
// then reporting depth, collapsed.
export default async function DashboardPage({ params }: { params: { projectId: string } }) {
  const [access, decisionLogAccess, riskRegisterAccess, milestonesAccess, pmPlanAccess, user] = await Promise.all([
    requireModuleAccess(params.projectId, "DASHBOARD", "READ_LIMITED"),
    getModuleAccess(params.projectId, "DECISION_LOG"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
    getModuleAccess(params.projectId, "MILESTONES"),
    getModuleAccess(params.projectId, "PM_PLAN"),
    requireUser(),
  ]);
  // READ_LIMITED (the Client default): overall progress only — no financial/
  // risk snapshot, no attention list, no health reasons.
  const financialsVisible = access !== "READ_LIMITED";
  // Budget Burn (dollar PV/EV/AC) comes from the testing-only Budget
  // Tracker, which is Super Admin only — same audience here.
  const showBudgetBurn = user.role === "ADMIN";

  const data = await getDashboardData(params.projectId);
  const { financial } = data;
  const base = `/projects/${data.project.id}`;

  const statusCount = (status: (typeof data.statusBreakdown)[number]["status"]) => data.statusBreakdown.find((s) => s.status === status)?.count ?? 0;
  const overdueCount = data.reminders.filter((r) => r.band === "OVERDUE").length;
  // Only warnings whose fix page this viewer can open.
  const warnings = financialsVisible
    ? data.warnings.filter((w) => (w.route === "risks" ? riskRegisterAccess !== "NONE" : milestonesAccess !== "NONE"))
    : [];
  const hasAttention = financialsVisible && (data.reminders.length > 0 || warnings.length > 0);
  const showDecisions = decisionLogAccess !== "NONE" && data.recentDecisions.length > 0;
  const sprint = data.currentSprint;

  return (
    <div className="space-y-6">
      {/* 1 · Where are we — every role with dashboard access */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<IconShield />}
          iconWrapClass="bg-slate-100"
          accentColor={RAG_COLORS[data.rag].text}
          label="Health"
          value={RAG_LABELS[data.rag]}
          valueColor={RAG_COLORS[data.rag].text}
          // Reasons can name risks/schedule figures — never for a READ_LIMITED Client.
          subtitle={
            data.rag === "NONE"
              ? "Add a client milestone, start a sprint, or log risks to rate health"
              : financialsVisible
                ? data.healthReasons.join(" · ") || "No issues found"
                : undefined
          }
        />
        <StatTile
          icon={<IconLayers />}
          iconWrapClass="bg-indigo-50 text-indigo-600"
          label={
            <span className="inline-flex items-center gap-1">
              Stage
              <InfoTooltip text="The first PM checklist stage with unfinished work — same rule as the Projects list and Portfolio." />
            </span>
          }
          value={data.stage.label}
          subtitle={data.stage.step > 0 ? `Stage ${data.stage.step} of ${data.stage.of} · PM checklist` : data.stage.of ? "Every PM stage done" : "No PM checklist items"}
        />
        <StatTile
          icon={<IconGauge />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label={sprint?.state === "RUNNING" ? "Current sprint" : "Sprint"}
          value={sprint ? sprint.name : "—"}
          subtitle={
            !sprint ? (
              "No sprints yet"
            ) : sprint.state === "RUNNING" ? (
              <span className="block">
                <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-blue-500" style={{ width: `${sprint.plannedPoints ? (sprint.earnedPoints / sprint.plannedPoints) * 100 : 0}%` }} />
                </span>
                <span className="mt-1 block">
                  {sprint.earnedPoints.toFixed(1)} of {sprint.plannedPoints.toFixed(1)} pts ·{" "}
                  {sprint.daysLeft > 1 ? `${sprint.daysLeft} days left` : sprint.daysLeft === 1 ? "ends tomorrow" : sprint.daysLeft === 0 ? "ends today" : <span className="font-medium text-rose-600">past end date — close it</span>}
                </span>
              </span>
            ) : (
              `Not started · planned ${formatShortDate(sprint.startDate)} – ${formatShortDate(sprint.endDate)}`
            )
          }
        />
        <StatTile
          icon={<IconTarget />}
          iconWrapClass="bg-violet-50 text-violet-600"
          label="Next milestone"
          value={data.nextMilestone?.name ?? "—"}
          subtitle={
            <>
              {data.nextMilestone ? formatDate(data.nextMilestone.date) : "Nothing upcoming"}
              {data.overdueMilestones.length > 0 && <span className="block font-medium text-rose-600">{data.overdueMilestones.length} overdue</span>}
              <span className="block">{data.plannedEnd ? `Planned end ${formatDate(data.plannedEnd)}` : "No planned end — no dated milestones"}</span>
            </>
          }
        />
      </div>

      {/* 2 · What needs me — PM/TPM/Admin safety net, never a Client */}
      {(hasAttention || showDecisions) && (
        <div className={hasAttention && showDecisions ? "grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" : undefined}>
          {hasAttention && (
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3">
              <SectionHeader
                icon={<IconBell />}
                iconWrapClass="bg-rose-50 text-rose-600"
                title="Needs attention"
                action={
                  overdueCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">{overdueCount} overdue</span>
                  )
                }
                className="mb-2"
              />
              {warnings.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {warnings.map((w) => (
                    <li key={w.text}>
                      <Link
                        href={`${base}/${w.route}`}
                        prefetch={false}
                        className={clsx(
                          "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:opacity-90",
                          w.tone === "red" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"
                        )}
                      >
                        <span aria-hidden>⚠</span>
                        <span className="min-w-0 flex-1">{w.text}</span>
                        <span className="shrink-0 text-xs font-medium opacity-70">Fix →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data.reminders.length > 0 && (
                <div className="space-y-1">
                  {data.reminders.slice(0, 6).map((r) => {
                    const color = r.band === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium;
                    return (
                      <Link key={r.id} href={`${base}/${r.route}`} prefetch={false} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">{r.itemText}</p>
                          <p className="text-xs text-slate-400">
                            {r.context} · {r.source === "ACTION_ITEM" ? "Due" : "Planned"} {formatDate(r.plannedDate)}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0" style={{ backgroundColor: color.bg, color: color.text }}>
                          {r.band === "OVERDUE" ? "Overdue" : "Due soon"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {data.reminders.length > 6 && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-right">
                  <Link href="/notifications" prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    +{data.reminders.length - 6} more on Reminders →
                  </Link>
                </div>
              )}
            </div>
          )}

          {showDecisions && (
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <SectionHeader
                icon={<IconBadge />}
                iconWrapClass="bg-violet-50 text-violet-600"
                title="Recent decisions"
                action={
                  <Link href={`${base}/decisions`} prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    View all →
                  </Link>
                }
                className="mb-2"
              />
              <div className="space-y-1">
                {data.recentDecisions.map((d) => (
                  <Link key={d.id} href={`${base}/decisions`} prefetch={false} className="block rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <p className="text-sm text-slate-800 line-clamp-2">{d.decision}</p>
                    <p className="text-xs text-slate-400">
                      {d.decidedByName ?? "—"}
                      {d.date ? ` · ${formatDate(d.date)}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {financialsVisible && !hasAttention && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800">
          <IconCheckCircle className="h-4 w-4" />
          Nothing overdue or due soon, and no data problems found.
        </div>
      )}

      {/* 3 · How far along — Governance (checklists) and Delivery (story points) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader
            icon={<IconCheckCircle />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            title={
              <span className="inline-flex items-center gap-1">
                Governance
                <InfoTooltip text="Checklist items completed across every checklist. Not Applicable and recurring cadence items don't count." />
              </span>
            }
            className="mb-3"
          />
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="shrink-0 text-center">
              <DeliveryProgressGauge value={data.overallPct} label="Governance" size={120} />
              <p className="text-xs text-slate-500">
                {data.completedItems} / {data.totalItems} items
              </p>
            </div>
            <div className="w-full min-w-0 space-y-2">
              {data.perChecklistSummary.map((c) => (
                <Bar key={c.name} label={c.name.replace(/ Checklist$/, "")} value={c.pct} detail={`${c.completed}/${c.total}`} color="#10B981" />
              ))}
              <p className="pt-1 text-xs text-slate-500">
                {statusCount("IN_PROGRESS")} in progress · {statusCount("NOT_STARTED")} not started
                {statusCount("AT_RISK") > 0 && ` · ${statusCount("AT_RISK")} at risk`}
                {overdueCount > 0 && <span className="font-medium text-rose-600"> · {overdueCount} overdue</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader
            icon={<IconTarget />}
            iconWrapClass="bg-blue-50 text-blue-600"
            title={
              <span className="inline-flex items-center gap-1">
                Delivery
                <InfoTooltip text="Story points done (points × % complete) out of the project's total WBS story points — Delivery → Tasks." />
              </span>
            }
            action={
              <Link href={`${base}/delivery`} prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Open Delivery →
              </Link>
            }
            className="mb-3"
          />
          {data.deliveryPct == null ? (
            <p className="text-sm text-slate-400">No WBS tasks yet — add them on Delivery → Tasks.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{formatPct(data.deliveryPct)}</span>
                <span className="text-sm text-slate-500">
                  {data.donePoints.toFixed(1)} of {data.totalPoints.toFixed(1)} story points done
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${data.deliveryPct * 100}%` }} />
              </div>
            </>
          )}
          {financialsVisible && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                  SPI
                  <InfoTooltip text="Schedule Performance Index: story points earned ÷ committed, across closed sprints (0/100 rule). The running sprint joins when it closes. Below 1.0 is behind plan; below 0.9 turns Health red." />
                </p>
                <p className="text-xl font-bold" style={{ color: financial.latestSpi != null ? INDEX_BAND_COLORS[indexBand(financial.latestSpi)].text : undefined }}>
                  {financial.latestSpi != null ? financial.latestSpi.toFixed(2) : "—"}
                </p>
                {financial.spiHistory.length > 1 ? (
                  <SpiSparkline
                    values={financial.spiHistory}
                    color={financial.latestSpi != null ? INDEX_BAND_COLORS[indexBand(financial.latestSpi)].text : INDEX_BAND_COLORS.unfavorable.text}
                  />
                ) : (
                  <p className="text-[11px] text-slate-400">{financial.latestSpi == null ? "No closed sprint yet" : "1 closed sprint"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                  Effort Index
                  <InfoTooltip text="Story points earned ÷ competency-adjusted man-days spent, closed sprints. Above 1.0: less effort than estimated. Estimate accuracy only — doesn't affect Health." />
                </p>
                <p className="text-xl font-bold" style={{ color: financial.effortIndex != null ? INDEX_BAND_COLORS[indexBand(financial.effortIndex)].text : undefined }}>
                  {financial.effortIndex != null ? financial.effortIndex.toFixed(2) : "—"}
                </p>
                <p className="text-[11px] text-slate-400">{financial.effortIndex == null ? "No closed sprint with hours yet" : "estimate accuracy"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 · Money — one bar instead of four tiles */}
      {financialsVisible && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader
            icon={<IconDollar />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            title="Contract & payments"
            action={
              milestonesAccess !== "NONE" && (
                <Link href={`${base}/milestones`} prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  Milestones &amp; Payments →
                </Link>
              )
            }
            className="mb-3"
          />
          {data.money.contractValue <= 0 ? (
            <p className="text-sm text-slate-400">No contract value set yet — add it on Milestones &amp; Payments.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-2">
                <p className="text-2xl font-bold text-slate-900">{formatMoney(data.money.contractValue)}</p>
                <MoneyBar money={data.money} />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Next payment</p>
                  {financial.nextPayment ? (
                    <p className="font-semibold text-slate-900">
                      {formatMoney(financial.nextPayment.amount)}
                      <span className="block text-xs font-normal text-slate-500">
                        {financial.nextPayment.name} · {financial.nextPayment.date ? formatDate(financial.nextPayment.date) : "no date set"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-slate-400">{data.money.unallocated > 0 ? "None scheduled — assign the rest of the contract to milestones" : "Everything is invoiced"}</p>
                  )}
                </div>
                {financial.activeCRValue > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Approved / in-progress change requests</p>
                    <p className="font-semibold text-slate-900">{financial.activeCRValue} man-days</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5 · Reporting depth, collapsed */}
      <DetailedReporting
        projectId={data.project.id}
        showBudgetBurn={showBudgetBurn}
        showMilestonesLink={milestonesAccess !== "NONE"}
        evmChartData={data.evmChartData}
        stageSummaryByType={data.stageSummaryByType}
        showProjectGantt={pmPlanAccess !== "NONE"}
        projectGanttRows={data.projectGanttRows}
        milestonesList={data.milestonesList}
      />
    </div>
  );
}

function Bar({ label, value, detail, color }: { label: string; value: number; detail: string; color: string }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 truncate text-slate-600">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </span>
      <span className="w-20 shrink-0 text-right text-slate-500">
        <span className="font-semibold text-slate-700">{formatPct(value)}</span> · {detail}
      </span>
    </div>
  );
}

function MoneyBar({ money }: { money: { contractValue: number; collected: number; awaiting: number; scheduled: number; unallocated: number } }) {
  const segments = [
    { label: "Collected", amount: money.collected, color: "#16A34A" },
    { label: "Invoiced, awaiting payment", amount: money.awaiting, color: "#F59E0B" },
    { label: "On milestones, not invoiced", amount: money.scheduled, color: "#93C5FD" },
    { label: "Not on any milestone", amount: money.unallocated, color: "#E2E8F0" },
  ];
  return (
    <>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((sg) =>
          sg.amount > 0 ? <div key={sg.label} title={`${sg.label}: ${formatMoney(sg.amount)}`} style={{ width: `${(sg.amount / money.contractValue) * 100}%`, backgroundColor: sg.color }} /> : null
        )}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {segments.map((sg) => (
          <li key={sg.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sg.color }} />
              {sg.label}
            </span>
            <span className="font-semibold text-slate-800">
              {formatMoney(sg.amount)} <span className="font-normal text-slate-400">{formatPct(sg.amount / money.contractValue)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
