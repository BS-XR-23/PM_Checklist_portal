import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { StatTile } from "@/components/ui/stat-tile";
import { IconTarget, IconDollar, IconCalendar, IconBadge, IconAlertTriangle } from "@/components/layout/icons";
import { CLOSING_SOON_DAYS, STAGE_WIN_PROBABILITY, dealFlags, dealValueUsd, summarizePipeline } from "@/lib/presales-pipeline";
import { PresalesPipeline } from "./presales-pipeline";
import type { PresalesCardData } from "./presales-filters";

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
        // The next step: earliest-due open action item (undated ones last).
        actionItems: {
          where: { status: { not: "Done" } },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { order: "asc" }],
          take: 1,
          select: { id: true, description: true, dueDate: true },
        },
        _count: { select: { actionItems: { where: { status: { not: "Done" } } } } },
      },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  // Flags are computed here, once, against the server's clock — not in the
  // client components — so the board and table can't disagree with each
  // other (or with Reminders) about what's overdue or stale.
  const today = new Date();
  const cards: PresalesCardData[] = opportunities.map(({ _count, ...o }) => {
    const deal = { ...o, openActionCount: _count.actionItems };
    return {
      ...o,
      openActionCount: _count.actionItems,
      valueUsd: dealValueUsd(o),
      winProbability: STAGE_WIN_PROBABILITY[o.stage],
      flags: dealFlags(deal, today),
    };
  });
  const summary = summarizePipeline(cards, today);

  const attentionParts = [
    summary.overdueCount && `${summary.overdueCount} past close date`,
    summary.staleCount && `${summary.staleCount} stale`,
    summary.noNextStepCount && `${summary.noNextStepCount} no next step`,
  ].filter(Boolean);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Presales Pipeline</h1>
            <p className="text-sm text-slate-500">Deals being pitched before a contract is signed — win one and it becomes a real project.</p>
          </div>
          {canWrite && (
            <Link
              href="/presales/new"
              className="inline-block shrink-0 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              + New Opportunity
            </Link>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-indigo-50 text-indigo-600"
            label="Open pipeline"
            value={formatMoney(summary.openValueUsd)}
            subtitle={`${summary.openCount} open deal${summary.openCount === 1 ? "" : "s"}`}
            nowrap
          />
          <StatTile
            icon={<IconTarget />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="Weighted forecast"
            value={formatMoney(summary.weightedValueUsd)}
            subtitle="value × stage win %"
            nowrap
          />
          <StatTile
            icon={<IconCalendar />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label={`Closing in ${CLOSING_SOON_DAYS} days`}
            value={String(summary.closingSoonCount)}
            subtitle={summary.closingSoonCount ? formatMoney(summary.closingSoonValueUsd) : "nothing due"}
            nowrap
          />
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass={summary.attentionCount ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}
            label="Needs attention"
            value={String(summary.attentionCount)}
            valueColor={summary.attentionCount ? "#B91C1C" : undefined}
            accentColor={summary.attentionCount ? "#EF4444" : undefined}
            subtitle={attentionParts.length ? attentionParts.join(" · ") : "all deals on track"}
          />
          <div className="col-span-2 lg:col-span-1">
            <StatTile
              icon={<IconBadge />}
              iconWrapClass="bg-emerald-50 text-emerald-600"
              label="Win rate"
              value={summary.winRate === null ? "—" : formatPct(summary.winRate)}
              subtitle={`${summary.wonCount} won · ${summary.lostCount} lost${summary.wonCount ? ` · ${formatMoney(summary.wonValueUsd)} won` : ""}`}
            />
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No opportunities yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {canWrite ? "Add the first deal you're pitching — it takes six fields." : "Nothing in the pipeline yet."}
            </p>
          </div>
        ) : (
          <PresalesPipeline cards={cards} byStage={summary.byStage} canWrite={canWrite} isAdmin={user.role === "ADMIN"} people={people} />
        )}
      </main>
    </AppShell>
  );
}
