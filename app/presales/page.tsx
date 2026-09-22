import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { IconTarget, IconDollar, IconCheckCircle, IconBadge, IconAlertCircle } from "@/components/layout/icons";
import { usdEquivalent } from "@/lib/presales-stage";
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

  const [opportunities, people] = await Promise.all([
    prisma.presalesProject.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        wonProject: { select: { id: true, name: true } },
        dealOwnerPerson: { select: { id: true, name: true } },
        actionItems: {
          where: { status: { not: "Done" } },
          orderBy: { dueDate: "asc" },
          take: 1,
          select: { id: true, description: true, dueDate: true },
        },
      },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const nonDeleted = opportunities.filter((o) => o.deletedAt === null);
  const openCards = nonDeleted.filter((o) => o.outcome === "OPEN");
  const wonCount = nonDeleted.filter((o) => o.outcome === "WON").length;
  const lostCount = nonDeleted.filter((o) => o.outcome === "LOST").length;
  // USD-normalized so BDT-quoted deals don't get summed as if they were USD.
  const openPipelineValue = openCards.reduce((sum, o) => sum + usdEquivalent(o.estimatedValue ?? 0, o.estimatedValueCurrency), 0);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Presales</h1>
            <p className="text-sm text-slate-500">Opportunities being pitched before a contract is signed — win it, and it becomes a real project.</p>
          </div>
          {canWrite && (
            <Link
              href="/presales/new"
              className="inline-block shrink-0 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              + New Presale
            </Link>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        <div className="grid sm:grid-cols-5 gap-4">
          <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Opportunities" value={String(nonDeleted.length)} />
          <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-amber-50 text-amber-600" label="Open" value={String(openCards.length)} />
          <StatTile icon={<IconBadge />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Won" value={String(wonCount)} />
          <StatTile icon={<IconAlertCircle />} iconWrapClass="bg-red-50 text-red-600" label="Lost" value={String(lostCount)} />
          <StatTile icon={<IconDollar />} iconWrapClass="bg-indigo-50 text-indigo-600" label="Total Pipeline Value" value={formatMoney(openPipelineValue)} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Opportunities</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">{canWrite ? "No opportunities yet. Create one above to get started." : "No presales opportunities yet."}</p>
          ) : (
            <PresalesFilters cards={opportunities} canWrite={canWrite} isAdmin={user.role === "ADMIN"} people={people} />
          )}
        </div>
      </main>
    </AppShell>
  );
}
