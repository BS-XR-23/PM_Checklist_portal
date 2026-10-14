import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { getReminderItems } from "@/lib/notifications";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData } from "@/lib/portfolio-data";
import { summarizeMilestones } from "@/lib/milestones";
import { CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectFilters, type ProjectCardData, type ProjectStats } from "./project-filters";
import { NewProjectDialog } from "./new-project-form";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();

  const canSeeAll = user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER";
  const isAdmin = user.role === "ADMIN";
  // Client/Guest viewers get name, health, stage and progress only — no
  // risk reasons, money, or milestone details (see ProjectFilters).
  const showInternals = user.role !== "CLIENT" && user.role !== "LIMITED";
  // Independent of each other — fetched concurrently instead of as
  // serialized round trips. The PM list and template counts only feed the
  // Super-Admin-only New Project dialog.
  const [projects, reminderItems, pmUsers, templateCounts] = await Promise.all([
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
    isAdmin ? prisma.user.findMany({ where: { role: "PM", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    isAdmin ? prisma.checklistTemplateItem.groupBy({ by: ["type"], _count: true }) : Promise.resolve([]),
  ]);
  const overdueCounts = new Map<string, number>();
  for (const r of reminderItems) {
    if (r.band === "OVERDUE" && r.projectId) overdueCounts.set(r.projectId, (overdueCounts.get(r.projectId) ?? 0) + 1);
  }

  // One computation, reused for the cards and the table — RAG/SPI/stage/
  // progress/next milestone/payments all come from the exact same source
  // `/portfolio` uses (lib/portfolio-data.ts), so a project's health reads
  // identically on both pages. `projects` includes soft-deleted rows
  // (Admin's Deleted tab needs them), so the stats below filter explicitly.
  const { rows } = buildPortfolioData(projects);

  const extrasById = new Map(
    projects.map((p) => {
      // Planned end = latest milestone date — same definition as the
      // single-project Dashboard's "Planned End" (lib/milestones.ts).
      const endDate = summarizeMilestones(p.milestones.map((m) => ({ ...m, ownerName: null })), p.contractValue).plannedEnd;
      return [p.id, { endDate, deletedAt: p.deletedAt, overdueCount: overdueCounts.get(p.id) ?? 0 }] as const;
    })
  );

  const cards: ProjectCardData[] = rows.map((r) => ({ ...r, ...extrasById.get(r.id)! }));
  // Live projects only — archived and deleted ones have no health, delivery,
  // or money "in flight" to report.
  const active = cards.filter((c) => c.deletedAt === null && c.status === "ACTIVE");
  const withWbs = active.filter((c) => c.deliveryPct != null);

  const stats: ProjectStats = {
    activeCount: active.length,
    health: {
      GREEN: active.filter((c) => c.rag === "GREEN").length,
      AMBER: active.filter((c) => c.rag === "AMBER").length,
      RED: active.filter((c) => c.rag === "RED").length,
      NONE: active.filter((c) => c.rag === "NONE").length,
    },
    contractValue: active.reduce((sum, c) => sum + c.contractValue, 0),
    paid: active.reduce((sum, c) => sum + c.paidAmount, 0),
    overdueItems: active.reduce((sum, c) => sum + c.overdueCount, 0),
    avgDelivery: withWbs.length ? withWbs.reduce((sum, c) => sum + (c.deliveryPct as number), 0) / withWbs.length : null,
    deliveryProjects: withWbs.length,
  };

  const checklistSummary = templateCounts
    .filter((t) => t._count > 0)
    .sort((a, b) => b._count - a._count)
    .map((t) => `${t._count} ${(CHECKLIST_TYPE_BY_KEY[t.type as ChecklistType]?.label ?? t.type).replace(/ Checklist$/, "")}`)
    .join(", ");

  return (
    <AppShell user={user}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 max-w-xl">
              {canSeeAll ? "Every signed project — worst health first, so what needs you is at the top." : "Your projects — worst health first, so what needs you is at the top."}
            </p>
          </div>
          {isAdmin && <NewProjectDialog pmUsers={pmUsers} checklistSummary={checklistSummary} />}
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No projects yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {isAdmin
                ? "Create one with New Project, or win a deal on the Presales pipeline."
                : canSeeAll
                  ? "Nothing has been created yet."
                  : "No projects have been assigned to you yet."}
            </p>
          </div>
        ) : (
          <ProjectFilters cards={cards} isAdmin={isAdmin} showInternals={showInternals} stats={stats} />
        )}
      </main>
    </AppShell>
  );
}
