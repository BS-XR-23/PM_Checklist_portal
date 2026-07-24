import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { NewProjectForm } from "./new-project-form";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { select: { status: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">XR PM Checklist Portal</h1>
        <p className="text-sm text-slate-500">Fixed-budget XR project governance — stage-gate checklists, milestones, risk, CRs, and budget/EVM.</p>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <NewProjectForm />

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">No projects yet. Create one above to get started.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p) => {
                const total = p.checklistItems.length;
                const completed = p.checklistItems.filter((i) => i.status === "COMPLETED").length;
                const pct = total ? completed / total : 0;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/dashboard`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{p.name}</h3>
                        {p.client && <p className="text-sm text-slate-500">{p.client}</p>}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{formatPct(pct)}</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-slate-800" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-slate-500">
                      <span>{completed} / {total} items complete</span>
                      {p.contractValue > 0 && <span>{formatMoney(p.contractValue)}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
