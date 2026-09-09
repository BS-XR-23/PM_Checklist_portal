import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canViewPortfolioOverload } from "@/lib/resourcing-rbac";
import { computePersonLoad, findOverlapConflicts, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { formatMoney, formatPct, formatDate, formatShortDate, formatDateTime, startOfMonthUTC } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { ATTENTION_SEVERITY_COLORS } from "@/lib/colors";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { IconLayers, IconClock, IconUsers, IconChart, IconDownload, IconAlertTriangle, IconDollar } from "@/components/layout/icons";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData, type PortfolioRow, type HealthIndex } from "@/lib/portfolio-data";
import { PortfolioClient } from "./portfolio-table";
import { RefreshButton } from "@/components/ui/refresh-button";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireUser();

  // Coarse, cross-project view: Admin/TPM/Program Manager only. Detailed,
  // item-level data lives inside each project's own modules — this page
  // links a viewer *to* a project's Dashboard, but never inlines that
  // module-level detail here itself.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER") {
    redirect("/projects");
  }

  const showOverload = canViewPortfolioOverload(user.role);
  const currentMonth = startOfMonthUTC(new Date());
  const generatedAt = new Date();

  // `projects` and `people` are independent of each other — fetched
  // concurrently instead of as two serialized round trips.
  const [projects, people] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: PORTFOLIO_PROJECT_INCLUDE,
    }),
    showOverload
      ? prisma.person.findMany({
          include: { engagements: { include: { project: true, months: { where: { month: currentMonth } } } } },
        })
      : Promise.resolve([]),
  ]);

  const { rows, summary, upcomingMilestones, trendPoints } = buildPortfolioData(projects);

  const overloadedPeople: { personName: string; totalActivePct: number; breakdown: string }[] = [];
  const conflictPairs: { personName: string; a: EngagementLike; b: EngagementLike }[] = [];

  if (showOverload) {
    for (const p of people) {
      const engagements: EngagementLike[] = p.engagements.map((e) => ({
        id: e.id,
        projectId: e.projectId,
        projectName: e.project.name,
        roleOnProject: e.roleOnProject,
        intensityPct: intensityForMonth(e.months, currentMonth),
        startDate: e.startDate,
        endDate: e.endDate,
      }));
      const load = computePersonLoad(engagements);
      if (load.isOverloaded) {
        overloadedPeople.push({
          personName: p.name,
          totalActivePct: load.totalActivePct,
          breakdown: load.activeEngagements.map((e) => `${e.projectName} (${e.intensityPct}%)`).join(", "),
        });
      }
      for (const c of findOverlapConflicts(engagements)) {
        conflictPairs.push({ personName: p.name, a: c.a, b: c.b });
      }
    }
  }

  const attentionRows = rows
    .filter((r) => r.status === "ACTIVE" && r.rag !== "GREEN")
    .sort((a, b) => (a.rag === b.rag ? b.openHighRisks - a.openHighRisks : a.rag === "RED" ? -1 : 1));

  const stageBreakdown = Array.from(
    rows.reduce((map, r) => map.set(r.stage, (map.get(r.stage) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const byContractValue = [...rows].sort((a, b) => b.contractValue - a.contractValue).slice(0, 6);
  const maxContractValue = Math.max(1, ...byContractValue.map((r) => r.contractValue));

  const middleContent = (
    <>
      {/* Portfolio Health */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <SectionHeader
          icon={<IconChart />}
          iconWrapClass="bg-blue-50 text-blue-600"
          title={
            <span className="inline-flex items-center gap-1.5">
              Portfolio Health
              <InfoTooltip text="Schedule/Budget Health average each active project's latest SPI/CPI (capped at 100%, and only shown once at least 2 projects have sprint data). Delivery Health is the share of remaining checklist work that isn't overdue. Risk Health is the share of active projects with zero open high-severity risks." />
            </span>
          }
        />
        <div className="grid lg:grid-cols-[1.1fr_1.4fr] gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Active projects by health</p>
            <HealthDistributionBar healthy={summary.healthy} atRisk={summary.atRisk} critical={summary.critical} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              <LegendDot color={RAG_COLORS.GREEN.text} bg={RAG_COLORS.GREEN.bg} label={`Healthy (${summary.healthy})`} />
              <LegendDot color={RAG_COLORS.AMBER.text} bg={RAG_COLORS.AMBER.bg} label={`At Risk (${summary.atRisk})`} />
              <LegendDot color={RAG_COLORS.RED.text} bg={RAG_COLORS.RED.bg} label={`Critical (${summary.critical})`} />
              <LegendDot color="#475569" bg="#E2E8F0" label={`Completed (${summary.completed})`} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <HealthIndexBar label="Schedule Health" index={summary.scheduleHealth} unit="SPI" />
            <HealthIndexBar label="Budget Health" index={summary.budgetHealth} unit="CPI" />
            <HealthIndexBar label="Delivery Health" index={summary.deliveryHealth} unit="checklist" />
            <HealthIndexBar label="Risk Health" index={summary.riskHealth} unit="risk" />
          </div>
        </div>
      </div>

      {/* Needs Management Attention */}
      {attentionRows.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <SectionHeader
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-amber-100 text-amber-700"
            title="Needs Management Attention"
            action={<span className="text-xs text-slate-500">{attentionRows.length} project{attentionRows.length > 1 ? "s" : ""} need review</span>}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {attentionRows.map((r) => (
              <AttentionCard key={r.id} row={r} />
            ))}
          </div>
        </div>
      )}

      {/* Overload & Conflicts — resourcing-specific attention, kept distinct from project health */}
      {showOverload && (overloadedPeople.length > 0 || conflictPairs.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <SectionHeader icon={<IconUsers />} iconWrapClass="bg-violet-50 text-violet-600" title="Overload & Conflicts" />
          {overloadedPeople.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Over threshold (combined active allocation &gt; 100%)</p>
              <ul className="text-sm text-slate-700 space-y-1">
                {overloadedPeople.map((o) => (
                  <li key={o.personName}>
                    <span className="font-medium text-slate-900">{o.personName}</span> — {o.totalActivePct}% total ({o.breakdown})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conflictPairs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">High-intensity engagements with overlapping dates (regardless of total)</p>
              <ul className="text-sm text-slate-700 space-y-1">
                {conflictPairs.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-900">{c.personName}</span> — {c.a.roleOnProject} on {c.a.projectName} ({c.a.intensityPct}%,{" "}
                    {formatDate(c.a.startDate)}–{formatDate(c.a.endDate)}) overlaps {c.b.roleOnProject} on {c.b.projectName} (
                    {c.b.intensityPct}%, {formatDate(c.b.startDate)}–{formatDate(c.b.endDate)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Financial Overview */}
      <div id="financial-overview" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <SectionHeader icon={<IconDollar />} iconWrapClass="bg-emerald-50 text-emerald-600" title="Financial Overview" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <FinancialStat label="Total Contract Value" value={formatMoney(summary.totalContractValue)} />
          <FinancialStat
            label="Invoiced"
            value={formatMoney(summary.invoicedTotal)}
            subtitle={summary.invoicedTotal === 0 ? "No invoices issued yet" : undefined}
          />
          <FinancialStat
            label="Collected"
            value={formatMoney(summary.collected)}
            valueColor={summary.collected > 0 ? RAG_COLORS.GREEN.text : undefined}
            subtitle={summary.collected === 0 ? (summary.invoicedTotal === 0 ? "No invoices issued yet" : "Invoiced, none collected yet") : undefined}
          />
          <FinancialStat
            label="Outstanding"
            value={formatMoney(summary.outstanding)}
            valueColor={summary.outstanding > 0 ? RAG_COLORS.AMBER.text : undefined}
            subtitle={
              summary.outstanding === 0
                ? "No invoices outstanding"
                : `${formatPct(summary.invoicedTotal ? summary.outstanding / summary.invoicedTotal : 0)} of invoiced awaiting payment`
            }
          />
          <FinancialStat
            label="Upcoming Invoice"
            value={summary.upcomingInvoice === 0 ? "—" : formatMoney(summary.upcomingInvoice)}
            subtitle={summary.upcomingInvoice === 0 ? "None scheduled" : "Work done, not yet invoiced"}
          />
        </div>
        <FinancialFunnel contractValue={summary.totalContractValue} invoiced={summary.invoicedTotal} collected={summary.collected} />
      </div>
    </>
  );

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Portfolio</h1>
          <p className="text-sm text-slate-500 max-w-2xl">Overview of project delivery, financial performance, risks, and management attention.</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <RefreshButton />
            <a
              href="/api/portfolio/export"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <IconDownload className="h-4 w-4" />
              Export
            </a>
          </div>
          <p className="text-[11px] text-slate-400">Last updated: {formatDateTime(generatedAt)}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <PortfolioClient rows={rows} summary={summary} middleContent={middleContent} />

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Upcoming Milestones */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SectionHeader icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" title="Upcoming Milestones" />
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-slate-400">No upcoming milestones.</p>
            ) : (
              <ul className="space-y-1">
                {upcomingMilestones.slice(0, 7).map((m, i) => {
                  const daysRemaining = Math.ceil((m.date.getTime() - generatedAt.getTime()) / 86400000);
                  const milestoneStatus =
                    daysRemaining < 0
                      ? { label: "Overdue", color: RAG_COLORS.RED }
                      : daysRemaining === 0
                        ? { label: "Due Today", color: RAG_COLORS.RED }
                        : daysRemaining <= 7
                          ? { label: "Due This Week", color: RAG_COLORS.AMBER }
                          : { label: "Upcoming", color: { bg: "#E2E8F0", text: "#475569" } };
                  return (
                    <li key={i}>
                      <Link
                        href={`/projects/${m.projectId}/milestones`}
                        prefetch={false}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                      >
                        <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{formatShortDate(m.date)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 font-medium truncate">{m.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {m.projectName} · {m.owner ?? "Unassigned"}
                          </p>
                        </div>
                        <span
                          className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: milestoneStatus.color.bg, color: milestoneStatus.color.text }}
                        >
                          {milestoneStatus.label === "Overdue"
                            ? `${Math.abs(daysRemaining)}d overdue`
                            : milestoneStatus.label === "Due Today"
                              ? "Due today"
                              : milestoneStatus.label === "Due This Week"
                                ? `${daysRemaining}d left`
                                : "Upcoming"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Portfolio Trends / Insights */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SectionHeader icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" title="Portfolio Trends & Insights" />
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Delivery &amp; Financial Trend (portfolio avg. SPI / CPI by week)</p>
                <SpiCpiChart data={trendPoints} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Projects by Stage (current)</p>
                <div className="space-y-1.5">
                  {stageBreakdown.map(([stage, count]) => (
                    <TrendBar key={stage} label={stage} value={count} max={rows.length} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Contract Value by Project (current)</p>
                <div className="space-y-1.5">
                  {byContractValue.map((r) => (
                    <TrendBar key={r.id} label={r.name} value={r.contractValue} max={maxContractValue} format={formatMoney} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function HealthDistributionBar({ healthy, atRisk, critical }: { healthy: number; atRisk: number; critical: number }) {
  const total = Math.max(1, healthy + atRisk + critical);
  return (
    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
      {healthy > 0 && <div style={{ width: `${(healthy / total) * 100}%`, backgroundColor: RAG_COLORS.GREEN.bg }} />}
      {atRisk > 0 && <div style={{ width: `${(atRisk / total) * 100}%`, backgroundColor: RAG_COLORS.AMBER.bg }} />}
      {critical > 0 && <div style={{ width: `${(critical / total) * 100}%`, backgroundColor: RAG_COLORS.RED.bg }} />}
    </div>
  );
}

function LegendDot({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bg, boxShadow: `inset 0 0 0 1px ${color}33` }} />
      {label}
    </span>
  );
}

const HEALTH_EXPLANATION: Record<string, string> = {
  SPI: "schedule",
  CPI: "cost",
  checklist: "checklist",
  risk: "risk",
};

function HealthIndexBar({ label, index, unit }: { label: string; index: HealthIndex; unit: string }) {
  const pct = index.value != null ? Math.round(index.value * 100) : null;
  const status = pct == null ? "N/A" : pct >= 90 ? "On Track" : pct >= 75 ? "Watch" : "Needs Attention";
  const color = pct == null ? "#94A3B8" : pct >= 90 ? RAG_COLORS.GREEN.text : pct >= 75 ? RAG_COLORS.AMBER.text : RAG_COLORS.RED.text;
  const barColor = pct == null ? "#CBD5E1" : pct >= 90 ? RAG_COLORS.GREEN.bg : pct >= 75 ? RAG_COLORS.AMBER.bg : RAG_COLORS.RED.bg;
  const explanation =
    pct != null
      ? null
      : index.eligible === 0
        ? "No active projects yet"
        : `Insufficient ${HEALTH_EXPLANATION[unit] ?? "data"} data — only ${index.sampleSize} of ${index.eligible} active project${index.eligible === 1 ? "" : "s"} reporting`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xs font-semibold" style={{ color }}>
          {pct != null ? `${pct}% · ${status}` : "N/A"}
        </p>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, backgroundColor: barColor }} />
      </div>
      {explanation && <p className="mt-1 text-[11px] text-slate-400">{explanation}</p>}
    </div>
  );
}

function AttentionCard({ row: r }: { row: PortfolioRow }) {
  const isCritical = r.rag === "RED";
  const issues = r.issues.length > 0 ? r.issues : [{ severity: "Low" as const, label: "Needs review" }];

  return (
    <div className="rounded-lg border bg-white p-3.5" style={{ borderColor: isCritical ? RAG_COLORS.RED.bg : RAG_COLORS.AMBER.bg }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isCritical ? RAG_COLORS.RED.text : RAG_COLORS.AMBER.text }} />
            <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
          </div>
          <span
            className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: isCritical ? RAG_COLORS.RED.bg : RAG_COLORS.AMBER.bg, color: isCritical ? RAG_COLORS.RED.text : RAG_COLORS.AMBER.text }}
          >
            {isCritical ? "Critical" : "At Risk"}
          </span>
          <div className="mt-2 flex flex-wrap gap-1">
            {issues.map((issue, i) => {
              const c = ATTENTION_SEVERITY_COLORS[issue.severity];
              return (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                  style={{ backgroundColor: c.bg, color: c.text }}
                  title={issue.severity}
                >
                  {issue.label}
                </span>
              );
            })}
          </div>
        </div>
        <Link
          href={`/projects/${r.id}/dashboard`}
          prefetch={false}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
        >
          View Project →
        </Link>
      </div>
    </div>
  );
}

function FinancialStat({ label, value, valueColor, subtitle }: { label: string; value: string; valueColor?: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold" style={{ color: valueColor }}>
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function FinancialFunnel({ contractValue, invoiced, collected }: { contractValue: number; invoiced: number; collected: number }) {
  const max = Math.max(1, contractValue);
  const paymentHealth = invoiced > 0 ? collected / invoiced : null;
  return (
    <div className="space-y-2.5">
      <FunnelRow label="Contract Value" amount={contractValue} pct={contractValue / max} color="#CBD5E1" />
      <FunnelRow label="Invoiced" amount={invoiced} pct={invoiced / max} color={RAG_COLORS.AMBER.bg} />
      <FunnelRow label="Collected" amount={collected} pct={collected / max} color={RAG_COLORS.GREEN.bg} />
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-slate-500">Payment Health (Collected of Invoiced)</p>
          <p className="text-xs font-semibold text-slate-700">{paymentHealth != null ? formatPct(paymentHealth) : "N/A"}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(paymentHealth ?? 0) * 100}%` }} />
        </div>
        {paymentHealth == null && <p className="mt-1 text-[11px] text-slate-400">No invoices issued</p>}
      </div>
    </div>
  );
}

function FunnelRow({ label, amount, pct, color }: { label: string; amount: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 shrink-0 text-xs text-slate-500">{label}</p>
      <div className="flex-1 h-3 rounded-full bg-slate-50 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: color }} />
      </div>
      <p className="w-24 shrink-0 text-right text-xs font-medium text-slate-700">{formatMoney(amount)}</p>
    </div>
  );
}

function TrendBar({ label, value, max, format }: { label: string; value: number; max: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="w-40 shrink-0 truncate text-xs text-slate-600" title={label}>
        {label}
      </p>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <p className="w-20 shrink-0 text-right text-xs text-slate-500">{format ? format(value) : value}</p>
    </div>
  );
}
