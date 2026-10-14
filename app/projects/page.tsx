import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { getReminderItems } from "@/lib/notifications";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData } from "@/lib/portfolio-data";
import { summarizeMilestones } from "@/lib/milestones";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectFilters, type ProjectCardData, type ProjectStats } from "./project-filters";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function ProjectsPage() {
  const user = await requireUser();

  const canSeeAll = user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER";
  const isAdmin = user.role === "ADMIN";
  // `projects` and `reminderItems` are independent of each other — fetched
  // concurrently instead of as two serialized round trips.
  const [projects, reminderItems] = await Promise.all([
    prisma.project.findMany({
      where: canSeeAll ? {} : { memberships: { some: { userId: user.id } }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: PORTFOLIO_PROJECT_INCLUDE,
      relationLoadStrategy: "join",
    }),
    // Same reminder-worthy items the sidebar badge/Dashboard rollup use —
    // already scoped to this viewer's role/projects (empty for Client/Limited/
    // Program Manager), so the card tag below never leaks it to a Client.
    getReminderItems(user),
  ]);
  const overdueCounts = new Map<string, number>();
  for (const r of reminderItems) {
    if (r.band === "OVERDUE" && r.projectId) overdueCounts.set(r.projectId, (overdueCounts.get(r.projectId) ?? 0) + 1);
  }

  // One computation, reused for the card grid — RAG/SPI/CPI/stage/progress/
  // PM-name all come from the exact same source `/portfolio` uses
  // (lib/portfolio-data.ts), so a project's health reads identically on both
  // pages instead of two slightly different definitions drifting apart.
  // `projects` includes soft-deleted rows (Admin's Deleted tab needs their
  // data too), so aggregates below are filtered to non-deleted explicitly
  // rather than trusting this call's own (deletion-unaware) summary.
  const { rows } = buildPortfolioData(projects);

  const extrasById = new Map(
    projects.map((p) => {
      // Planned end = latest milestone date — same definition as the
      // single-project Dashboard's "Planned End" (lib/milestones.ts).
      const endDate = summarizeMilestones(p.milestones.map((m) => ({ ...m, ownerName: null })), p.contractValue).plannedEnd;
      // Governance %/Delivery %/health come from the shared portfolio row
      // (lib/portfolio-data.ts → lib/project-health.ts), not recomputed here.
      return [
        p.id,
        {
          createdAt: p.createdAt,
          endDate,
          deletedAt: p.deletedAt,
          overdueCount: overdueCounts.get(p.id) ?? 0,
        },
      ] as const;
    })
  );

  const cards: ProjectCardData[] = rows.map((r) => ({ ...r, ...extrasById.get(r.id)! }));
  const nonDeletedCards = cards.filter((c) => c.deletedAt === null);
  const activeCards = nonDeletedCards.filter((c) => c.status === "ACTIVE");

  const totalContractValue = nonDeletedCards.reduce((sum, c) => sum + c.contractValue, 0);
  const withWbs = nonDeletedCards.filter((c) => c.deliveryPct != null);
  const avgDelivery = withWbs.length ? withWbs.reduce((sum, c) => sum + (c.deliveryPct as number), 0) / withWbs.length : null;
  const newIn30Days = nonDeletedCards.filter((c) => Date.now() - c.createdAt.getTime() <= THIRTY_DAYS_MS).length;

  const stats: ProjectStats = {
    totalProjects: nonDeletedCards.length,
    activeCount: activeCards.length,
    totalContractValue,
    avgDelivery,
    newIn30Days,
  };

  return (
    <AppShell user={user}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500">
            {canSeeAll ? "No projects yet. Create one above to get started." : "No projects have been assigned to you yet."}
          </p>
        ) : (
          <ProjectFilters cards={cards} isAdmin={isAdmin} stats={stats} />
        )}
      </main>
    </AppShell>
  );
}
