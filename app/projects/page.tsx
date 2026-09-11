import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatShortDate } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { COMPLETED_STAGE_LABEL } from "@/lib/calculations";
import { getReminderItems } from "@/lib/notifications";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData } from "@/lib/portfolio-data";
import { RAG_COLORS } from "@/lib/rag";
import { AppShell } from "@/components/layout/app-shell";
import { HealthDonutChart } from "@/components/charts/health-donut-chart";
import { DeliveryProgressGauge } from "@/components/charts/delivery-progress-gauge";
import { ProjectFilters, type ProjectCardData, type ProjectStats } from "./project-filters";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function ProjectsPage() {
  const user = await requireUser();

  const canSeeAll = user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER";
  const isAdmin = user.role === "ADMIN";
  const projects = await prisma.project.findMany({
    where: canSeeAll ? {} : { memberships: { some: { userId: user.id } }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: PORTFOLIO_PROJECT_INCLUDE,
  });

  // Same reminder-worthy items the sidebar badge/Dashboard rollup use —
  // already scoped to this viewer's role/projects (empty for Client/Limited/
  // Program Manager), so the card tag below never leaks it to a Client.
  const reminderItems = await getReminderItems(user);
  const overdueCounts = new Map<string, number>();
  for (const r of reminderItems) {
    if (r.band === "OVERDUE" && r.projectId) overdueCounts.set(r.projectId, (overdueCounts.get(r.projectId) ?? 0) + 1);
  }

  // One computation, reused for both the card grid and the insights below —
  // RAG/SPI/CPI/stage/progress/PM-name/milestones all come from the exact
  // same source `/portfolio` uses (lib/portfolio-data.ts), so a project's
  // health reads identically on both pages instead of two slightly
  // different definitions drifting apart. `projects` includes soft-deleted
  // rows (Admin's Deleted tab needs their data too), so aggregates below are
  // filtered to non-deleted explicitly rather than trusting this call's own
  // (deletion-unaware) summary.
  const { rows, upcomingMilestones: allUpcomingMilestones } = buildPortfolioData(projects);

  const extrasById = new Map(
    projects.map((p) => {
      const applicable = p.checklistItems.filter((i) => i.status !== "NOT_APPLICABLE");
      // Derived "end date" — latest Actual Date across the checklist, same
      // definition the single-project Dashboard uses.
      const endDate = applicable.reduce<Date | null>((latest, i) => {
        if (!i.actualDate) return latest;
        return !latest || i.actualDate > latest ? i.actualDate : latest;
      }, null);
      return [p.id, { createdAt: p.createdAt, endDate, deletedAt: p.deletedAt, overdueCount: overdueCounts.get(p.id) ?? 0 }] as const;
    })
  );

  const cards: ProjectCardData[] = rows.map((r) => ({ ...r, ...extrasById.get(r.id)! }));
  const nonDeletedCards = cards.filter((c) => c.deletedAt === null);
  const activeCards = nonDeletedCards.filter((c) => c.status === "ACTIVE");

  const healthy = activeCards.filter((c) => c.rag === "GREEN").length;
  const atRisk = activeCards.filter((c) => c.rag === "AMBER").length;
  const critical = activeCards.filter((c) => c.rag === "RED").length;
  const completedCount = nonDeletedCards.filter((c) => c.stage === COMPLETED_STAGE_LABEL).length;
  const totalContractValue = nonDeletedCards.reduce((sum, c) => sum + c.contractValue, 0);
  const avgProgress = activeCards.length ? activeCards.reduce((sum, c) => sum + c.progress, 0) / activeCards.length : 0;
  const newIn30Days = nonDeletedCards.filter((c) => Date.now() - c.createdAt.getTime() <= THIRTY_DAYS_MS).length;

  const stats: ProjectStats = {
    totalProjects: nonDeletedCards.length,
    activeCount: activeCards.length,
    healthy,
    atRisk,
    critical,
    totalContractValue,
    newIn30Days,
  };

  const upcomingMilestones = allUpcomingMilestones.filter((m) => extrasById.get(m.projectId)?.deletedAt === null);

  const stageBreakdown = Array.from(
    nonDeletedCards.reduce((map, c) => map.set(c.stage, (map.get(c.stage) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell user={user}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500">
            {canSeeAll ? "No projects yet. Create one above to get started." : "No projects have been assigned to you yet."}
          </p>
        ) : (
          <ProjectFilters cards={cards} isAdmin={isAdmin} canSeeAll={canSeeAll} stats={stats} />
        )}

        {/* One compact, fixed-height strip instead of two full-size stacked
            cards — deliberately short (roughly half a project card's
            height) so it reads as a glanceable summary bar, not a second
            full section competing with the card grid above it. */}
        {nonDeletedCards.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 h-36 overflow-hidden">
            <div className="flex h-full divide-x divide-slate-100">
              <div className="flex-[1.4] min-w-0 pr-4 overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Upcoming Milestones</span>
                  {canSeeAll && (
                    <Link href="/portfolio" prefetch={false} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 shrink-0">
                      View all →
                    </Link>
                  )}
                </div>
                {upcomingMilestones.length === 0 ? (
                  <p className="text-xs text-slate-400">No upcoming milestones.</p>
                ) : (
                  <ul className="space-y-1">
                    {upcomingMilestones.slice(0, 3).map((m, i) => {
                      const daysRemaining = Math.ceil((m.date.getTime() - Date.now()) / 86400000);
                      const status =
                        daysRemaining < 0
                          ? RAG_COLORS.RED
                          : daysRemaining <= 7
                            ? RAG_COLORS.AMBER
                            : { bg: "#E2E8F0", text: "#475569" };
                      return (
                        <li key={i}>
                          <Link href={`/projects/${m.projectId}/milestones`} prefetch={false} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-50">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: status.text }} />
                            <span className="text-xs font-medium text-slate-700 truncate">{m.name}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">· {m.projectName}</span>
                            <span className="ml-auto text-[11px] text-slate-500 shrink-0">{formatShortDate(m.date)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex-1 min-w-0 px-4 overflow-hidden">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Projects by Health</span>
                <div className="mt-1.5">
                  <HealthDonutChart healthy={healthy} atRisk={atRisk} critical={critical} completed={completedCount} size={72} />
                </div>
              </div>

              <div className="flex-1 min-w-0 px-4 overflow-hidden flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide self-start">Delivery Progress</span>
                <div className="flex-1 flex items-center">
                  <DeliveryProgressGauge value={avgProgress} label="Avg. Progress" size={72} />
                </div>
              </div>

              <div className="flex-1 min-w-0 pl-4 overflow-hidden">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Projects by Stage</span>
                {/* A compact inline version, not the shared TrendBar — that
                    component's fixed label/value widths are sized for
                    Portfolio's much wider layout and get clipped by this
                    panel's overflow-hidden in a ~250px column. */}
                <div className="mt-2 space-y-1.5">
                  {stageBreakdown.slice(0, 3).map(([stage, count]) => (
                    <div key={stage} className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-600 truncate flex-1 min-w-0">{stage}</span>
                      <div className="w-10 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(count / nonDeletedCards.length) * 100}%` }} />
                      </div>
                      <span className="text-slate-500 shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
