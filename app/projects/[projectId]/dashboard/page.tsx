import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatPct, formatMoney, formatDate } from "@/lib/format";
import { RISK_SEVERITY_COLORS, INDEX_BAND_COLORS, indexBand } from "@/lib/colors";
import { RAG_COLORS } from "@/lib/rag";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  IconChart,
  IconShield,
  IconLayers,
  IconClock,
  IconDollar,
  IconGrid,
  IconBell,
  IconBadge,
  IconCircle,
  IconCheckCircle,
  IconAlertCircle,
  IconAlertTriangle,
  IconTarget,
} from "@/components/layout/icons";
import { SpiSparkline } from "@/components/charts/spi-sparkline";
import { DetailedReporting } from "./detailed-reporting";

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

  // Both cards are often short (a handful of rows at most) — side by side
  // instead of each stacked full-width avoids a tall column of mostly-empty
  // white space. Falls back to one full-width card when only one of the two
  // has anything to show, rather than leaving it alone in a half-width column.
  const showOverdue = financialsVisible && data.reminders.length > 0;
  const showDecisions = decisionLogAccess !== "NONE" && data.recentDecisions.length > 0;

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

      {/* Not financial data — visible to every role with dashboard access, same as the completion hero above.
          The "where are we" strip: health, stage, end date, next milestone — none of this existed as a single
          glanceable row before (Health/Next Milestone weren't shown anywhere on this page at all). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<IconShield />}
          iconWrapClass="bg-slate-100"
          bgClass="bg-white"
          accentColor={RAG_COLORS[data.rag].text}
          label="Health"
          value={RAG_COLORS[data.rag].label}
          valueColor={RAG_COLORS[data.rag].text}
        />
        <StatTile icon={<IconLayers />} iconWrapClass="bg-blue-50 text-blue-600" label="Current Stage (PM Checklist)" value={data.pmStage} />
        <StatTile icon={<IconClock />} iconWrapClass="bg-emerald-50 text-emerald-600" label="End Date" value={data.endDate ? formatDate(data.endDate) : "—"} />
        <StatTile
          icon={<IconTarget />}
          iconWrapClass="bg-violet-50 text-violet-600"
          label="Next Milestone"
          value={data.nextMilestone?.name ?? "—"}
          subtitle={data.nextMilestone ? formatDate(data.nextMilestone.date) : undefined}
        />
      </div>

      {(showOverdue || showDecisions) && (
        <div className={showOverdue && showDecisions ? "grid lg:grid-cols-2 gap-4 items-start" : undefined}>
          {/* Same visibility as the financial stat tiles below — an overdue-item
              list is a PM/TPM/Admin safety net, not something to surface to a
              Client. */}
          {showOverdue && (
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

          {showDecisions && (
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
        </div>
      )}

      {/* One consistent grid instead of a 5-tile row followed by a
          mismatched 3-tile row — the ragged second row left a chunk of
          empty width on anything wide enough for 5 columns. */}
      {financialsVisible && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={<IconChart />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label={
              <span className="inline-flex items-center gap-1">
                Latest SPI
                <InfoTooltip text="This is the Budget Tracker's SPI/CPI — dollar-cost based (EV÷PV, EV÷AC). It's not the same figure as Delivery's Sprints/Overview SPI/CPI, which is effort based (EV÷PV, EV÷AV). Both are legitimate; they just answer different questions." />
              </span>
            }
            value={financial.latestSpi != null ? financial.latestSpi.toFixed(2) : "—"}
            valueColor={financial.latestSpi != null ? INDEX_BAND_COLORS[indexBand(financial.latestSpi)].text : undefined}
            subtitle={
              <SpiSparkline
                values={financial.spiHistory}
                color={financial.latestSpi != null ? INDEX_BAND_COLORS[indexBand(financial.latestSpi)].text : INDEX_BAND_COLORS.unfavorable.text}
              />
            }
          />
          <StatTile
            icon={<IconChart />}
            iconWrapClass="bg-violet-50 text-violet-600"
            label="Latest CPI"
            value={financial.latestCpi != null ? financial.latestCpi.toFixed(2) : "—"}
            valueColor={financial.latestCpi != null ? INDEX_BAND_COLORS[indexBand(financial.latestCpi)].text : undefined}
            subtitle={financial.latestCpi == null ? "No data" : undefined}
          />
          <StatTile
            icon={<IconShield />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Open High Risks"
            value={String(financial.openHighRisks)}
            valueColor={financial.openHighRisks > 0 ? INDEX_BAND_COLORS.unfavorable.text : undefined}
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
          <StatTile icon={<IconDollar />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Contract Value" value={formatMoney(financial.contractValue)} />
          <StatTile icon={<IconDollar />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Paid to Date" value={formatMoney(financial.paidAmount)} />
          <StatTile icon={<IconDollar />} iconWrapClass="bg-amber-50 text-amber-600" label="Invoiced (Awaiting Payment)" value={formatMoney(financial.invoicedAmount)} />
        </div>
      )}

      <DetailedReporting
        projectId={data.project.id}
        financialsVisible={financialsVisible}
        showMilestonesLink={milestonesAccess !== "NONE"}
        statusBreakdown={data.statusBreakdown}
        perChecklistSummary={data.perChecklistSummary}
        evmChartData={data.evmChartData}
        stageSummaryByType={data.stageSummaryByType}
        timelineStrip={data.timelineStrip}
        milestonesList={data.milestonesList}
      />
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
