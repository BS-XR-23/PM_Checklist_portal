import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { NewPresalesForm } from "./new-presales-form";
import { PresalesFilters } from "./presales-filters";

export const dynamic = "force-dynamic";

// Internal pipeline data — the deal team (PM/Admin) plus leadership
// (TPM/Program Manager) can see it, read-only for the latter; never
// CLIENT/LIMITED.
const VIEW_ROLES = ["ADMIN", "PM", "TPM", "PROGRAM_MANAGER"] as const;

export default async function PresalesPage() {
  const user = await requireUser();
  if (!VIEW_ROLES.includes(user.role as (typeof VIEW_ROLES)[number])) redirect("/projects");

  const canWrite = user.role === "ADMIN" || user.role === "PM";

  const opportunities = await prisma.presalesProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { wonProject: { select: { id: true, name: true } } },
  });

  const openCards = opportunities.filter((o) => o.outcome === "OPEN" && o.deletedAt === null);
  const openPipelineValue = openCards.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);
  const closedCount = opportunities.filter((o) => o.outcome === "WON" || o.outcome === "LOST").length;
  const wonCount = opportunities.filter((o) => o.outcome === "WON").length;
  const winRate = closedCount ? wonCount / closedCount : null;

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Presales</h1>
        <p className="text-sm text-slate-500">Opportunities being pitched before a contract is signed — win it, and it becomes a real project.</p>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {canWrite && <NewPresalesForm />}

        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile label="Open Opportunities" value={String(openCards.length)} />
          <StatTile label="Open Pipeline Value" value={formatMoney(openPipelineValue)} />
          <StatTile label="Win Rate" value={winRate != null ? formatPct(winRate) : "—"} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Opportunities</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">{canWrite ? "No opportunities yet. Create one above to get started." : "No presales opportunities yet."}</p>
          ) : (
            <PresalesFilters cards={opportunities} canWrite={canWrite} isAdmin={user.role === "ADMIN"} />
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
