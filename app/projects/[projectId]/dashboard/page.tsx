import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatPct, formatMoney, formatDate } from "@/lib/format";
import { STATUS_COLORS, RISK_SEVERITY_COLORS, INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import {
  IconChart,
  IconShield,
  IconLayers,
  IconClock,
  IconDollar,
  IconGrid,
  IconClipboardList,
  IconBell,
  IconBadge,
  IconCircle,
  IconCheckCircle,
  IconAlertCircle,
  IconAlertTriangle,
} from "@/components/layout/icons";
import { StatusPieChart } from "@/components/charts/status-pie-chart";
import { CompletionBarChart } from "@/components/charts/completion-bar-chart";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiSparkline } from "@/components/charts/spi-sparkline";
import { TimelineStrip } from "@/components/dashboard/timeline-strip";

export default async function DashboardPage({ params }: { params: { projectId: string } }) {
  const [access, decisionLogAccess, riskRegisterAccess, milestonesAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "DASHBOARD", "READ_LIMITED"),
    getModuleAccess(params.projectId, "DECISION_LOG"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
    getModuleAccess(params.projectId, "MILESTONES"),
  ]);
  // READ_LIMITED (the Client default): overall progress only — no financial/
  // risk snapshot, no cost-bearing budget-burn chart.
  const financialsVisible = access !== "READ_LIMITED";

  const data = await getDashboardData(params.projectId);
  const { financial } = data;

  const statusCount = (status: (typeof data.statusBreakdown)[number]["status"]) =>
    data.statusBreakdown.find((s) => s.status === status)?.count ?? 0;
  const overdueCount = data.reminders.filter((r) => r.band === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-[220px]">
            <p className="text-sm text-slate-500">Overall % Complete</p>
            <p className="text-4xl font-bold text-slate-900">{formatPct(data.overallPct)}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-800" style={{ width: `${data.overallPct * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {data.completedItems} / {data.totalItems} checklist items complete
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <HeroStat icon={<IconGrid />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Items" value={data.totalItems} />
            <HeroStat icon={<IconCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Not Started" value={statusCount("NOT_STARTED")} />
            <HeroStat icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Completed" value={data.completedItems} />
            <HeroStat icon={<IconAlertCircle />} iconWrapClass="bg-rose-50 text-rose-600" label="Overdue" value={overdueCount} />
            <HeroStat icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" label="In Progress" value={statusCount("IN_PROGRESS")} />
            <HeroStat icon={<IconAlertTriangle />} iconWrapClass="bg-amber-50 text-amber-600" label="At Risk" value={statusCount("AT_RISK")} />
          </div>
        </div>
      </div>

      {/* Not financial data — visible to every role with dashboard access, same as the completion hero above. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-blue-50 text-blue-600" label="Current Stage (PM Checklist)" value={data.pmStage} />
        <StatTile icon={<IconClock />} iconWrapClass="bg-emerald-50 text-emerald-600" label="End Date" value={data.endDate ? formatDate(data.endDate) : "—"} />
      </div>

      {/* Same visibility as the financial stat tiles below — an overdue-item
          list is a PM/TPM/Admin safety net, not something to surface to a
          Client. */}
      {financialsVisible && data.reminders.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader
            icon={<IconBell />}
            iconWrapClass="bg-rose-50 text-rose-600"
            title="Overdue & Due Soon"
            action={
              overdueCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  {overdueCount} Overdue
                </span>
              )
            }
            className="mb-2"
          />
          <div className="space-y-1.5">
            {data.reminders.map((r) => {
              const color = r.band === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium;
              return (
                <Link
                  key={r.id}
                  href={`/projects/${data.project.id}/${r.route}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{r.itemText}</p>
                    <p className="text-xs text-slate-400">{r.context} · {r.source === "ACTION_ITEM" ? "Due" : "Planned"} {formatDate(r.plannedDate)}</p>
                  </div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {r.band === "OVERDUE" ? "Overdue" : "Due Soon"}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-right">
            <Link href="/notifications" prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all tasks →
            </Link>
          </div>
        </div>
      )}

      {decisionLogAccess !== "NONE" && data.recentDecisions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader
            icon={<IconBadge />}
            iconWrapClass="bg-violet-50 text-violet-600"
            title="Recent Decisions"
            action={
              <Link
                href={`/projects/${data.project.id}/decisions`}
                prefetch={false}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all →
              </Link>
            }
            className="mb-2"
          />
          <div className="space-y-1.5">
            {data.recentDecisions.map((d) => (
              <Link
                key={d.id}
                href={`/projects/${data.project.id}/decisions`}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
              >
                <p className="text-sm text-slate-800 truncate">{d.decision}</p>
                <p className="text-xs text-slate-400 shrink-0">
                  {d.decidedByName ?? "—"}{d.date ? ` · ${formatDate(d.date)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {financialsVisible && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatTile
            icon={<IconChart />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="Latest SPI"
            value={financial.latestSpi != null ? financial.latestSpi.toFixed(2) : "—"}
            valueColor={financial.latestSpi != null ? (financial.latestSpi >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR) : undefined}
            subtitle={
              <SpiSparkline
                values={financial.spiHistory}
                color={financial.latestSpi != null && financial.latestSpi >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR}
              />
            }
          />
          <StatTile
            icon={<IconChart />}
            iconWrapClass="bg-violet-50 text-violet-600"
            label="Latest CPI"
            value={financial.latestCpi != null ? financial.latestCpi.toFixed(2) : "—"}
            valueColor={financial.latestCpi != null ? (financial.latestCpi >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR) : undefined}
            subtitle={financial.latestCpi == null ? "No data" : undefined}
          />
          <StatTile
            icon={<IconShield />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Open High Risks"
            value={String(financial.openHighRisks)}
            valueColor={financial.openHighRisks > 0 ? INDEX_UNFAVORABLE_COLOR : undefined}
            subtitle={
              riskRegisterAccess !== "NONE" ? (
                <Link href={`/projects/${data.project.id}/risks`} prefetch={false} className="font-medium text-indigo-600 hover:text-indigo-700">
                  View all →
                </Link>
              ) : undefined
            }
          />
          <StatTile icon={<IconLayers />} iconWrapClass="bg-amber-50 text-amber-600" label="Active CR Value (man-days)" value={String(financial.activeCRValue)} />
          <StatTile
            icon={<IconClock />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Next Payment Due"
            value={financial.nextPaymentDue ? formatDate(financial.nextPaymentDue) : "—"}
            subtitle={financial.nextPaymentDue ? formatMoney(financial.nextPaymentAmount) : undefined}
          />
        </div>
      )}

      {financialsVisible && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile icon={<IconDollar />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Contract Value" value={formatMoney(financial.contractValue)} />
          <StatTile icon={<IconDollar />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Paid to Date" value={formatMoney(financial.paidAmount)} />
          <StatTile icon={<IconDollar />} iconWrapClass="bg-amber-50 text-amber-600" label="Invoiced (Awaiting Payment)" value={formatMoney(financial.invoicedAmount)} />
        </div>
      )}

      <div className={financialsVisible ? "grid lg:grid-cols-3 gap-4" : "grid lg:grid-cols-2 gap-4"}>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader icon={<IconChart />} iconWrapClass="bg-blue-50 text-blue-600" title="Status Breakdown (All Checklists)" className="mb-2" />
          <StatusPieChart data={data.statusBreakdown} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader icon={<IconGrid />} iconWrapClass="bg-violet-50 text-violet-600" title="% Complete by Checklist" className="mb-2" />
          <CompletionBarChart data={data.perChecklistSummary.map((c) => ({ name: c.name, pct: c.pct }))} />
        </div>
        {financialsVisible && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SectionHeader icon={<IconDollar />} iconWrapClass="bg-amber-50 text-amber-600" title="Budget Burn (PV / EV / AC)" className="mb-2" />
            <EvmLineChart data={data.evmChartData} />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader icon={<IconLayers />} iconWrapClass="bg-blue-50 text-blue-600" title="Stage / Category Breakdown" />
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">PM Checklist</p>
              {data.pmStageSummary.map((s) => (
                <StageRow key={s.stage} stage={s.stage} total={s.total} completed={s.completed} pct={s.pct} />
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">DevOps Checklist</p>
              {data.devopsStageSummary.map((s) => (
                <StageRow key={s.stage} stage={s.stage} total={s.total} completed={s.completed} pct={s.pct} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SectionHeader icon={<IconClock />} iconWrapClass="bg-emerald-50 text-emerald-600" title="Timeline (Planned → Actual, by Stage/Category)" />
          <TimelineStrip rows={data.timelineStrip} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <SectionHeader icon={<IconClipboardList />} iconWrapClass="bg-emerald-50 text-emerald-600" title="Key Milestones" className="" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">Checklist</th>
              <th className="px-3 py-2 font-medium">Stage / Category</th>
              <th className="px-3 py-2 font-medium">Milestone</th>
              <th className="px-3 py-2 font-medium">Actual Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.milestonesList.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{m.source}</td>
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{m.stage}</td>
                <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-nowrap">{m.milestoneName}</td>
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatDate(m.actualDate)}</td>
                <td className="px-3 py-1.5">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                    style={{ backgroundColor: STATUS_COLORS[m.status].bg, color: STATUS_COLORS[m.status].text }}
                  >
                    {STATUS_COLORS[m.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {milestonesAccess !== "NONE" && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-right">
            <Link
              href={`/projects/${data.project.id}/milestones`}
              prefetch={false}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all milestones →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroStat({ icon, iconWrapClass, label, value }: { icon: React.ReactNode; iconWrapClass: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-base font-bold leading-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StageRow({ stage, total, completed, pct }: { stage: string; total: number; completed: number; pct: number }) {
  return (
    <div className="flex items-center gap-3 py-1 text-sm">
      <div className="w-40 shrink-0 text-slate-600 truncate">{stage}</div>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-slate-800" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="w-24 shrink-0 text-right text-xs text-slate-500">
        {completed}/{total} ({formatPct(pct)})
      </div>
    </div>
  );
}
