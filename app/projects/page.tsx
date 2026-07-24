import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { NewProjectForm } from "./new-project-form";
import { SignOutLink } from "@/components/ui/sign-out-link";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();

  // Program Manager gets the coarse portfolio rollup, never this detailed list.
  if (user.role === "PROGRAM_MANAGER") redirect("/portfolio");

  const canSeeAll = user.role === "ADMIN" || user.role === "TPM";
  const projects = await prisma.project.findMany({
    where: canSeeAll ? {} : { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { select: { status: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">XR PM Checklist Portal</h1>
          <p className="text-sm text-slate-500">Fixed-budget XR project governance — stage-gate checklists, milestones, risk, CRs, and budget/EVM.</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(user.role === "ADMIN" || user.role === "TPM") && (
            <Link href="/portfolio" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Portfolio
            </Link>
          )}
          {user.role === "ADMIN" && (
            <>
              <Link href="/admin/users" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Users
              </Link>
              <Link href="/admin/audit-log" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Audit Log
              </Link>
            </>
          )}
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">{user.role.replace("_", " ")}</span>
          <SignOutLink />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {user.role === "ADMIN" && <NewProjectForm />}

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">
              {canSeeAll ? "No projects yet. Create one above to get started." : "No projects have been assigned to you yet."}
            </p>
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
