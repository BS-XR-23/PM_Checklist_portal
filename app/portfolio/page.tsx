import Link from "next/link";
import clsx from "clsx";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canViewPortfolioOverload } from "@/lib/resourcing-rbac";
import { computePersonLoad, findOverlapConflicts, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { formatMoney, formatPct, formatDate, formatShortDate, formatDateTime, formatMonthShortLabel, startOfMonthUTC } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import type { BillingBucket } from "@/lib/billing-forecast";
import { ATTENTION_SEVERITY_COLORS } from "@/lib/colors";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TrendBar } from "@/components/ui/trend-bar";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { IconLayers, IconClock, IconUsers, IconDownload, IconAlertTriangle, IconDollar, IconCheckCircle } from "@/components/layout/icons";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData, type PortfolioRow, type PortfolioSummary } from "@/lib/portfolio-data";
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
      relationLoadStrategy: "join",
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
    .filter((r) => r.status === "ACTIVE" && (r.rag === "RED" || r.rag === "AMBER"))
    .sort((a, b) => (a.rag === b.rag ? b.openHighRisks - a.openHighRisks : a.rag === "RED" ? -1 : 1));

  // Active projects only — same scope as every other figure on the page.
  const activeRows = rows.filter((r) => r.status === "ACTIVE");
  const stageBreakdown = Array.from(
    activeRows.reduce((map, r) => map.set(r.stage, (map.get(r.stage) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const middleContent = (
    <>
      {/* Needs Management Attention — first, because it's what this page is for */}
      {attentionRows.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <SectionHeader
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-amber-100 text-amber-700"
            title="Needs Management Attention"
            action={<span className="text-xs text-slate-500">{attentionRows.length} project{attentionRows.length > 1 ? "s" : ""} to review</span>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attentionRows.map((r) => (
              <AttentionCard key={r.id} row={r} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800">
          <IconCheckCircle className="h-4 w-4" />
          No active project is Critical or At Risk.
        </div>
      )}

      {/* Overload & Conflicts — resourcing-specific attention, kept distinct from project health */}
      {showOverload && (overloadedPeople.length > 0 || conflictPairs.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <SectionHeader
            icon={<IconUsers />}
            iconWrapClass="bg-violet-50 text-violet-600"
            title={
              <span className="inline-flex items-center gap-1.5">
                Overload &amp; Conflicts
                <InfoTooltip text="Overload: a person's summed intensity across every active engagement exceeds 100% of capacity. Conflict: two of a person's engagements have overlapping date ranges — a separate check from overload, since two low-intensity engagements can still overlap without pushing anyone over capacity." />
              </span>
            }
          />
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

      <BillingSection summary={summary} />
    </>
  );

  const showTrend = trendPoints.length >= 2;

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Portfolio</h1>
          <p className="text-sm text-slate-500 max-w-2xl">Active projects at a glance — what needs attention, what money is due, and how delivery is tracking.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Upcoming Milestones */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SectionHeader icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" title="Upcoming Milestones" />
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-slate-400">No dated client milestones on active projects. Add dates on each project&apos;s Milestones &amp; Payments tab.</p>
            ) : (
              <ul className="space-y-1">
                {upcomingMilestones.slice(0, 7).map((m, i) => {
                  const daysRemaining = Math.ceil((m.date.getTime() - generatedAt.getTime()) / 86400000);
                  const tone =
                    daysRemaining < 0 || daysRemaining === 0 ? RAG_COLORS.RED : daysRemaining <= 7 ? RAG_COLORS.AMBER : { bg: "#E2E8F0", text: "#475569" };
                  const label = daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : daysRemaining === 0 ? "Due today" : daysRemaining <= 7 ? `${daysRemaining}d left` : `in ${daysRemaining}d`;
                  return (
                    <li key={i}>
                      <Link href={`/projects/${m.projectId}/milestones`} prefetch={false} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{formatShortDate(m.date)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 font-medium truncate">{m.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {m.projectName} · {m.owner ?? "Unassigned"}
                          </p>
                        </div>
                        <span
                          className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: tone.bg, color: tone.text }}
                        >
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Delivery trend + stage mix — only what there's real data for */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SectionHeader icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" title="Delivery Trend & Stages" />
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Portfolio avg. SPI / Effort Index by closed sprint</p>
                {showTrend ? (
                  <SpiCpiChart data={trendPoints} secondLabel="Effort Index" />
                ) : (
                  <p className="text-sm text-slate-400">
                    {trendPoints.length === 1 ? "Only one closed sprint across active projects so far — the trend appears after the next one closes." : "No closed sprints on active projects yet."}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Active projects by stage</p>
                {stageBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400">No active projects.</p>
                ) : (
                  <div className="space-y-1.5">
                    {stageBreakdown.map(([stage, count]) => (
                      <TrendBar key={stage} label={stage} value={count} max={activeRows.length} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

/**
 * Money for active projects in one place: where the contract stands
 * (collected / invoiced-unpaid / scheduled / not tied to a milestone), what
 * should be invoiced and when, and the data gaps that stop a forecast.
 */
function BillingSection({ summary }: { summary: PortfolioSummary }) {
  const b = summary.billing;
  const contract = summary.totalContractValue;
  const notInvoiced = Math.max(0, contract - summary.invoicedTotal - b.unallocated.amount);
  const segments = [
    { label: "Collected", amount: summary.collected, color: "#16A34A" },
    { label: "Invoiced, awaiting payment", amount: summary.outstanding, color: "#F59E0B" },
    { label: "Scheduled on milestones, not invoiced", amount: notInvoiced, color: "#93C5FD" },
    { label: "Not tied to any milestone", amount: b.unallocated.amount, color: "#E2E8F0" },
  ];
  const rows: { key: string; label: string; bucket: BillingBucket; tone?: "green" | "red" }[] = [
    ...(b.ready.items.length ? [{ key: "ready", label: "Ready to invoice", bucket: b.ready, tone: "green" as const }] : []),
    ...(b.overdue.items.length ? [{ key: "overdue", label: "Past due date", bucket: b.overdue, tone: "red" as const }] : []),
    ...b.months.map((m) => ({ key: m.month, label: formatMonthShortLabel(new Date(`${m.month}-01T00:00:00Z`)), bucket: m })),
    ...(b.later.items.length ? [{ key: "later", label: "Later", bucket: b.later }] : []),
  ];
  const maxBucket = Math.max(1, ...rows.map((r) => r.bucket.amount));
  const anyScheduled = rows.some((r) => r.bucket.items.length > 0);

  return (
    <div id="billing" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <SectionHeader
        icon={<IconDollar />}
        iconWrapClass="bg-emerald-50 text-emerald-600"
        title={
          <span className="inline-flex items-center gap-1.5">
            Billing &amp; Cash
            <InfoTooltip text="Active projects only. Built from each project's Milestones & Payments: a tranche is contract value × payment %. Ready to invoice = the milestone is completed but not invoiced yet. Months use the milestone's forecast date if re-forecast, otherwise its planned date." />
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Contract value — active projects</p>
            <p className="text-2xl font-bold text-slate-900">{formatMoney(contract)}</p>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {segments.map((sg) => (sg.amount > 0 && contract > 0 ? <div key={sg.label} title={`${sg.label}: ${formatMoney(sg.amount)}`} style={{ width: `${(sg.amount / contract) * 100}%`, backgroundColor: sg.color }} /> : null))}
          </div>
          <ul className="space-y-1 text-xs">
            {segments.map((sg) => (
              <li key={sg.label} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sg.color }} />
                  {sg.label}
                </span>
                <span className="font-semibold text-slate-800">
                  {formatMoney(sg.amount)}
                  <span className="ml-1 font-normal text-slate-400">{contract > 0 ? formatPct(sg.amount / contract) : ""}</span>
                </span>
              </li>
            ))}
          </ul>

          {(b.unallocated.projects.length > 0 || b.undated.items.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold">Can&apos;t be forecast yet</p>
              <ul className="space-y-1">
                {b.unallocated.projects.map((p) => (
                  <li key={p.projectId}>
                    <Link href={`/projects/${p.projectId}/milestones`} prefetch={false} className="font-medium hover:underline">
                      {p.projectName}
                    </Link>
                    : {formatPct(p.pct)} of the contract ({formatMoney(p.amount)}) isn&apos;t assigned to any milestone payment
                  </li>
                ))}
                {b.undated.items.map((i) => (
                  <li key={`${i.projectId}-${i.milestoneName}`}>
                    <Link href={`/projects/${i.projectId}/milestones`} prefetch={false} className="font-medium hover:underline">
                      {i.projectName}
                    </Link>
                    : &ldquo;{i.milestoneName}&rdquo; ({formatPct(i.paymentPct)}, {formatMoney(i.amount)}) has no date
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Billing forecast — not-yet-invoiced tranches by due month</p>
            {b.dueSoonCount > 0 && (
              <p className="text-xs text-slate-500">
                Next 90 days: <span className="font-semibold text-slate-800">{formatMoney(b.dueSoonAmount)}</span> ({b.dueSoonCount})
              </p>
            )}
          </div>
          {!anyScheduled ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              No dated, un-invoiced payment tranches on active projects. Set each milestone&apos;s payment % and date on Milestones &amp; Payments to see the forecast.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.key}>
                  <details className="group">
                    <summary className={clsx("flex cursor-pointer list-none items-center gap-3 rounded-md px-1.5 py-1 hover:bg-slate-50", r.bucket.items.length === 0 && "pointer-events-none")}>
                      <span className={clsx("w-28 shrink-0 text-xs", r.tone === "red" ? "font-semibold text-red-700" : r.tone === "green" ? "font-semibold text-emerald-700" : "text-slate-600")}>{r.label}</span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-50">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(r.bucket.amount / maxBucket) * 100}%`, backgroundColor: r.tone === "red" ? "#F87171" : r.tone === "green" ? "#4ADE80" : "#93C5FD" }}
                        />
                      </span>
                      <span className="w-28 shrink-0 text-right text-xs">
                        {r.bucket.items.length ? (
                          <>
                            <span className="font-semibold text-slate-800">{formatMoney(r.bucket.amount)}</span>
                            <span className="ml-1 text-slate-400">· {r.bucket.items.length}</span>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </span>
                    </summary>
                    {r.bucket.items.length > 0 && (
                      <ul className="mb-1 ml-32 mt-1 space-y-0.5 text-xs text-slate-600">
                        {r.bucket.items.map((i) => (
                          <li key={`${i.projectId}-${i.milestoneName}`} className="flex justify-between gap-2">
                            <Link href={`/projects/${i.projectId}/milestones`} prefetch={false} className="truncate hover:underline">
                              {i.projectName} · {i.milestoneName} ({formatPct(i.paymentPct)})
                            </Link>
                            <span className="shrink-0 text-slate-500">
                              {formatMoney(i.amount)}
                              {i.due ? ` · ${formatShortDate(i.due)}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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

