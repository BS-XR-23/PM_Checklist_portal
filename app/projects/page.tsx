import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectForm } from "./new-project-form";

export const dynamic = "force-dynamic";

// Purely decorative, deterministic per project id — no data encoded, so no
// need for the dataviz skill's categorical-palette treatment.
const AVATAR_COLORS = [
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#ECFDF5", text: "#047857" },
  { bg: "#FFF7ED", text: "#C2410C" },
  { bg: "#FDF2F8", text: "#BE185D" },
  { bg: "#EFF6FF", text: "#1D4ED8" },
  { bg: "#F5F3FF", text: "#6D28D9" },
];
function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

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

  const cards = projects.map((p) => {
    const total = p.checklistItems.length;
    const completed = p.checklistItems.filter((i) => i.status === "COMPLETED").length;
    const pct = total ? completed / total : 0;
    return { ...p, total, completed, pct };
  });
  const avgCompletion = cards.length ? cards.reduce((sum, c) => sum + c.pct, 0) / cards.length : 0;
  const totalContractValue = cards.reduce((sum, c) => sum + c.contractValue, 0);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-500">Fixed-budget XR project governance — stage-gate checklists, milestones, risk, CRs, and budget/EVM.</p>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {user.role === "ADMIN" && <NewProjectForm />}

        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile label="Active Projects" value={String(cards.length)} />
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((p) => {
                const color = avatarColor(p.id);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/dashboard`}
                    prefetch={false}
                    className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0"
                          style={{ backgroundColor: color.bg, color: color.text }}
                        >
                          {p.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-medium text-slate-900 truncate">{p.name}</h3>
                          {p.client && <p className="text-sm text-slate-500 truncate">{p.client}</p>}
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-semibold">
                        {formatPct(p.pct)}
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-slate-800" style={{ width: `${p.pct * 100}%` }} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <StatChip label="Items" value={`${p.completed}/${p.total}`} />
                      <StatChip label="Value" value={p.contractValue > 0 ? formatMoney(p.contractValue) : "—"} />
                      <StatChip label="Started" value={formatDate(p.createdAt)} />
                    </div>
                  </Link>
                );
              })}
            </div>
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium truncate">{value}</p>
    </div>
  );
}
