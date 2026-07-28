import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { currentStage } from "@/lib/calculations";
import { PM_STAGES } from "@/lib/seed-data";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectForm } from "./new-project-form";
import { ProjectFilters } from "./project-filters";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();

  // Program Manager gets the coarse portfolio rollup, never this detailed list.
  if (user.role === "PROGRAM_MANAGER") redirect("/portfolio");

  const canSeeAll = user.role === "ADMIN" || user.role === "TPM";
  const projects = await prisma.project.findMany({
    where: canSeeAll ? {} : { memberships: { some: { userId: user.id } }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { select: { type: true, stage: true, status: true, forecastDate: true } } },
  });

  const cards = projects.map((p) => {
    // N/A items don't count toward completion at all — same treatment as
    // the Dashboard (lib/dashboard-data.ts).
    const applicable = p.checklistItems.filter((i) => i.status !== "NOT_APPLICABLE");
    const total = applicable.length;
    const completed = applicable.filter((i) => i.status === "COMPLETED").length;
    const pct = total ? completed / total : 0;
    const pmStage = currentStage(p.checklistItems.filter((i) => i.type === "PM"), PM_STAGES) ?? "Complete";
    // Derived "end date" — latest Forecast Date across PM+DevOps items, same
    // definition used on the project's own Dashboard (lib/dashboard-data.ts).
    const endDate = applicable.reduce<Date | null>((latest, i) => {
      if (!i.forecastDate) return latest;
      return !latest || i.forecastDate > latest ? i.forecastDate : latest;
    }, null);
    return { ...p, total, completed, pct, pmStage, endDate };
  });

  // Archived (done) projects shouldn't dilute "current portfolio" numbers.
  const activeCards = cards.filter((c) => c.status === "ACTIVE" && c.deletedAt === null);
  const avgCompletion = activeCards.length ? activeCards.reduce((sum, c) => sum + c.pct, 0) / activeCards.length : 0;
  const totalContractValue = activeCards.reduce((sum, c) => sum + c.contractValue, 0);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-500">Fixed-budget XR project governance — stage-gate checklists, milestones, risk, CRs, and budget/EVM.</p>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {user.role === "ADMIN" && <NewProjectForm />}

        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile label="Active Projects" value={String(activeCards.length)} />
          <StatTile label="Avg. Completion" value={formatPct(avgCompletion)} />
          <StatTile label="Total Contract Value" value={formatMoney(totalContractValue)} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Projects</h2>
          {cards.length === 0 ? (
            <p className="text-sm text-slate-500">
              {canSeeAll ? "No projects yet. Create one above to get started." : "No projects have been assigned to you yet."}
            </p>
          ) : (
            <ProjectFilters cards={cards} isAdmin={user.role === "ADMIN"} />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
