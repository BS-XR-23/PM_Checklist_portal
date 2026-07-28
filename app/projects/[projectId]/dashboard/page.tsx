import { getDashboardData } from "@/lib/dashboard-data";
import { formatPct, formatMoney, formatDate } from "@/lib/format";
import { STATUS_COLORS, INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPieChart } from "@/components/charts/status-pie-chart";
import { CompletionBarChart } from "@/components/charts/completion-bar-chart";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { TimelineStrip } from "@/components/dashboard/timeline-strip";

export default async function DashboardPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "DASHBOARD", "READ_LIMITED");
  // READ_LIMITED (the Client default): overall progress only — no financial/
  // risk snapshot, no cost-bearing budget-burn chart.
  const financialsVisible = access !== "READ_LIMITED";

  const data = await getDashboardData(params.projectId);
  const { financial } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm text-slate-500">Overall % Complete</p>
            <p className="text-4xl font-semibold text-slate-900">{formatPct(data.overallPct)}</p>
          </div>
          <p className="text-sm text-slate-500">
            {data.completedItems} / {data.totalItems} checklist items complete
          </p>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-slate-800" style={{ width: `${data.overallPct * 100}%` }} />
        </div>
      </div>

      {/* Not financial data — visible to every role with dashboard access, same as the completion hero above. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <StatTile label="Current Stage (PM Checklist)" value={data.pmStage} />
        <StatTile label="End Date" value={data.endDate ? formatDate(data.endDate) : "—"} />
      </div>

      {financialsVisible && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatTile label="Latest SPI" value={financial.latestSpi != null ? financial.latestSpi.toFixed(2) : "—"} valueColor={financial.latestSpi != null ? (financial.latestSpi >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR) : undefined} />
          <StatTile label="Latest CPI" value={financial.latestCpi != null ? financial.latestCpi.toFixed(2) : "—"} valueColor={financial.latestCpi != null ? (financial.latestCpi >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR) : undefined} />
          <StatTile label="Open High Risks" value={String(financial.openHighRisks)} valueColor={financial.openHighRisks > 0 ? INDEX_UNFAVORABLE_COLOR : undefined} />
          <StatTile label="Active CR Value (man-days)" value={String(financial.activeCRValue)} />
          <StatTile
            label="Next Payment Due"
            value={financial.nextPaymentDue ? formatDate(financial.nextPaymentDue) : "—"}
            hint={financial.nextPaymentDue ? formatMoney(financial.nextPaymentAmount) : undefined}
          />
        </div>
      )}

      {financialsVisible && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile label="Total Contract Value" value={formatMoney(financial.contractValue)} />
          <StatTile label="Paid to Date" value={formatMoney(financial.paidAmount)} />
          <StatTile label="Invoiced (Awaiting Payment)" value={formatMoney(financial.invoicedAmount)} />
        </div>
      )}

      <div className={financialsVisible ? "grid lg:grid-cols-3 gap-4" : "grid lg:grid-cols-2 gap-4"}>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Status Breakdown (All Checklists)</h3>
          <StatusPieChart data={data.statusBreakdown} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">% Complete by Checklist</h3>
          <CompletionBarChart data={data.perChecklistSummary.map((c) => ({ name: c.name, pct: c.pct }))} />
        </div>
        {financialsVisible && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Budget Burn (PV / EV / AC)</h3>
            <EvmLineChart data={data.evmChartData} />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Stage / Category Breakdown</h3>
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

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Timeline (Planned → Forecast, by Stage/Category)</h3>
          <TimelineStrip rows={data.timelineStrip} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Key Milestones</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">Checklist</th>
              <th className="px-3 py-2 font-medium">Stage / Category</th>
              <th className="px-3 py-2 font-medium">Milestone</th>
              <th className="px-3 py-2 font-medium">Forecast Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.milestonesList.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{m.source}</td>
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{m.stage}</td>
                <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-nowrap">{m.milestoneName}</td>
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatDate(m.forecastDate)}</td>
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
