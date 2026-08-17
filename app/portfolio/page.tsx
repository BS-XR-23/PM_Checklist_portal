import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canViewPortfolioOverload } from "@/lib/resourcing-rbac";
import { computeProjectRag, RAG_COLORS } from "@/lib/rag";
import { budgetEntriesFromSprints, toSprintsForBudget } from "@/lib/calculations";
import { computePersonLoad, findOverlapConflicts, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { formatMoney, formatDate, startOfMonthUTC } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireUser();

  // Coarse, cross-project view: Admin/TPM/Program Manager only. This is
  // deliberately a dead-end summary — no links into any project's detail
  // pages, so a Program Manager never reaches item-level data through here.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER") {
    redirect("/projects");
  }

  const showOverload = canViewPortfolioOverload(user.role);
  const currentMonth = startOfMonthUTC(new Date());

  // `projects` and `people` are independent of each other — fetched
  // concurrently instead of as two serialized round trips.
  const [projects, people] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        sprints: {
          orderBy: { startDate: "asc" },
          include: { tasks: { include: { person: { include: { roleRate: true } } } } },
        },
        risks: true,
      },
    }),
    showOverload
      ? prisma.person.findMany({
          include: { engagements: { include: { project: true, months: { where: { month: currentMonth } } } } },
        })
      : Promise.resolve([]),
  ]);

  const rows = projects.map((p) => {
    const budgetEntries = budgetEntriesFromSprints(toSprintsForBudget(p.sprints), p.plannedStoryPoints);
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      contractValue: p.contractValue,
      ...computeProjectRag({ contractValue: p.contractValue, budgetEntries, risks: p.risks }),
    };
  });

  const exceptions = rows.filter((r) => r.rag === "RED");
  const totalContractValue = rows.reduce((sum, r) => sum + r.contractValue, 0);

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

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Portfolio Summary</h1>
        <p className="text-sm text-slate-500">
          RAG status and rollup budget/schedule health across every project — no item-level detail. That lives in
          each project&apos;s own modules, which this view intentionally doesn&apos;t link into.
        </p>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Projects</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Contract Value</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalContractValue)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Exceptions (Red)</p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: exceptions.length > 0 ? RAG_COLORS.RED.text : undefined }}>
              {exceptions.length}
            </p>
          </div>
        </div>

        {exceptions.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Exceptions — needs attention</h3>
            <ul className="text-sm text-red-800 space-y-1">
              {exceptions.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.name}</span>
                  {r.openHighRisks > 0 && ` — ${r.openHighRisks} open high risk${r.openHighRisks > 1 ? "s" : ""}`}
                  {(r.latestSpi != null && r.latestSpi < 0.9) && ` — SPI ${r.latestSpi.toFixed(2)}`}
                  {(r.latestCpi != null && r.latestCpi < 0.9) && ` — CPI ${r.latestCpi.toFixed(2)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showOverload && (overloadedPeople.length > 0 || conflictPairs.length > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-amber-900">Overload &amp; Conflicts</h3>
            {overloadedPeople.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-800 mb-1">Over threshold (combined active allocation &gt; 100%)</p>
                <ul className="text-sm text-amber-900 space-y-1">
                  {overloadedPeople.map((o) => (
                    <li key={o.personName}>
                      <span className="font-medium">{o.personName}</span> — {o.totalActivePct}% total ({o.breakdown})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {conflictPairs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-800 mb-1">
                  High-intensity engagements with overlapping dates (regardless of total)
                </p>
                <ul className="text-sm text-amber-900 space-y-1">
                  {conflictPairs.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.personName}</span> — {c.a.roleOnProject} on {c.a.projectName} ({c.a.intensityPct}%,{" "}
                      {formatDate(c.a.startDate)}–{formatDate(c.a.endDate)}) overlaps {c.b.roleOnProject} on {c.b.projectName} (
                      {c.b.intensityPct}%, {formatDate(c.b.startDate)}–{formatDate(c.b.endDate)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 font-medium w-20">RAG</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium w-32">Contract Value</th>
                <th className="px-3 py-2 font-medium w-24">Latest SPI</th>
                <th className="px-3 py-2 font-medium w-24">Latest CPI</th>
                <th className="px-3 py-2 font-medium w-32">Open High Risks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ragColor = RAG_COLORS[r.rag];
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: ragColor.bg, color: ragColor.text }}
                      >
                        {ragColor.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.client || "—"}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatMoney(r.contractValue)}</td>
                    <td className="px-3 py-2 text-slate-700">{r.latestSpi != null ? r.latestSpi.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{r.latestCpi != null ? r.latestCpi.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{r.openHighRisks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No projects yet.</p>}
        </div>
      </main>
    </AppShell>
  );
}
