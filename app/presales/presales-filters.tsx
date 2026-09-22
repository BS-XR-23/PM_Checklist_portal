"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatShortDate, formatDate, initials } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { PRESALES_STAGE_COLORS, avatarColorFromString } from "@/lib/colors";
import { STAGE_ORDER, STAGE_INFO, formatByCurrency } from "@/lib/presales-stage";
import { InlineSelect } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { IconSearch, IconCalendar } from "@/components/layout/icons";
import { RowActionsMenu, type RowAction } from "@/components/ui/row-actions-menu";
import { updatePresalesProject, deletePresalesProject, restorePresalesProject, permanentlyDeletePresalesProject } from "./actions";
import type { PresalesOutcome, PresalesStage, PresalesForecastCategory, PresalesCurrency } from "@prisma/client";

export type PresalesCardData = {
  id: string;
  name: string;
  client: string | null;
  estimatedValue: number | null;
  estimatedValueCurrency: PresalesCurrency;
  expectedCloseDate: Date | null;
  outcome: PresalesOutcome;
  stage: PresalesStage;
  dealOwnerPersonId: string | null;
  dealOwnerPerson: { id: string; name: string } | null;
  pocDone: boolean;
  onHold: boolean;
  holdReason: string | null;
  forecastCategory: PresalesForecastCategory | null;
  industry: string | null;
  technology: string | null;
  lostReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  wonProject: { id: string; name: string } | null;
  actionItems: { id: string; description: string; dueDate: Date | null }[];
};

const OUTCOME_BADGE: Record<PresalesOutcome, { bg: string; text: string; label: string }> = {
  OPEN: RAG_COLORS.AMBER,
  WON: RAG_COLORS.GREEN,
  LOST: RAG_COLORS.RED,
};

// One combined tooltip for the whole Stage column — unlike the detail page's
// per-field tooltip (which only needs to explain the one stage a deal is
// currently in), a column header isn't tied to a single row's value, so this
// lists all four so a reader doesn't have to open each opportunity to recall
// what "Proposal" vs "Negotiation" means.
const STAGE_LEGEND = STAGE_ORDER.map((s) => `${PRESALES_STAGE_COLORS[s].label}: ${STAGE_INFO[s]}`).join("\n\n");

type Filter = "ALL" | "OPEN" | "WON" | "LOST" | "DELETED";
type SortKey = "updatedAt" | "value" | "closeDate" | "name";
const PAGE_SIZES = [10, 25, 50] as const;
const UNASSIGNED = "__unassigned__";

function matchesSearch(p: PresalesCardData, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return p.name.toLowerCase().includes(s) || (p.client ?? "").toLowerCase().includes(s) || (p.dealOwnerPerson?.name ?? "").toLowerCase().includes(s);
}

function compareRows(a: PresalesCardData, b: PresalesCardData, key: SortKey): number {
  switch (key) {
    case "value":
      return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
    case "closeDate":
      return (a.expectedCloseDate?.getTime() ?? Infinity) - (b.expectedCloseDate?.getTime() ?? Infinity);
    case "name":
      return a.name.localeCompare(b.name);
    case "updatedAt":
    default:
      return b.updatedAt.getTime() - a.updatedAt.getTime();
  }
}

export function PresalesFilters({
  cards,
  canWrite,
  isAdmin,
  people,
}: {
  cards: PresalesCardData[];
  canWrite: boolean;
  isAdmin: boolean;
  people: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [dealOwnerFilter, setDealOwnerFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("updatedAt");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  const nonDeleted = useMemo(() => cards.filter((c) => c.deletedAt === null), [cards]);
  const counts = useMemo(
    () => ({
      ALL: nonDeleted.length,
      OPEN: nonDeleted.filter((c) => c.outcome === "OPEN").length,
      WON: nonDeleted.filter((c) => c.outcome === "WON").length,
      LOST: nonDeleted.filter((c) => c.outcome === "LOST").length,
      DELETED: cards.filter((c) => c.deletedAt !== null).length,
    }),
    [cards, nonDeleted]
  );

  // Only owners actually assigned to an opportunity — a dropdown of every
  // Person in the org (most of whom have never owned a deal) would be much
  // less useful here than in People/Resourcing.
  const dealOwners = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of cards) if (c.dealOwnerPerson) byId.set(c.dealOwnerPerson.id, c.dealOwnerPerson.name);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);
  const hasUnassigned = useMemo(() => cards.some((c) => c.dealOwnerPersonId === null), [cards]);

  const filtered = useMemo(() => {
    const scoped = cards
      .filter((c) => (filter === "DELETED" ? c.deletedAt !== null : c.deletedAt === null))
      .filter((c) => filter === "ALL" || filter === "DELETED" || c.outcome === filter)
      .filter((c) => matchesSearch(c, search))
      .filter((c) => {
        if (!dealOwnerFilter) return true;
        if (dealOwnerFilter === UNASSIGNED) return c.dealOwnerPersonId === null;
        return c.dealOwnerPersonId === dealOwnerFilter;
      })
      .filter((c) => !stageFilter || c.stage === stageFilter);
    return [...scoped].sort((a, b) => compareRows(a, b, sort));
  }, [cards, filter, search, dealOwnerFilter, stageFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All" count={counts.ALL} active={filter === "ALL"} onClick={() => { setFilter("ALL"); setPage(1); }} />
          <FilterPill label="Open" count={counts.OPEN} active={filter === "OPEN"} onClick={() => { setFilter("OPEN"); setPage(1); }} />
          <FilterPill label="Won" count={counts.WON} active={filter === "WON"} onClick={() => { setFilter("WON"); setPage(1); }} />
          <FilterPill label="Lost" count={counts.LOST} active={filter === "LOST"} onClick={() => { setFilter("LOST"); setPage(1); }} />
          {isAdmin && (
            <FilterPill label="Deleted" count={counts.DELETED} active={filter === "DELETED"} onClick={() => { setFilter("DELETED"); setPage(1); }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by opportunity, client, or owner…"
              className="w-72 rounded-md border border-slate-300 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <select
            value={dealOwnerFilter}
            onChange={(e) => { setDealOwnerFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-300 px-2.5 py-2 text-xs text-slate-600"
          >
            <option value="">All Deal Owners</option>
            {dealOwners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            {hasUnassigned && <option value={UNASSIGNED}>No owner</option>}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-300 px-2.5 py-2 text-xs text-slate-600"
          >
            <option value="">All Stages</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {PRESALES_STAGE_COLORS[s].label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-slate-300 px-2.5 py-2 text-xs text-slate-600"
          >
            <option value="updatedAt">Sort by: Last Updated</option>
            <option value="value">Sort by: Value</option>
            <option value="closeDate">Sort by: Close Date</option>
            <option value="name">Sort by: Name</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Opportunity</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Client</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Deal Owner</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  Stage
                  <InfoTooltip text={STAGE_LEGEND} placement="top" />
                </span>
              </th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Value</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Close Date</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => (
              <PresalesRow key={p.id} p={p} canWrite={canWrite} isAdmin={isAdmin} people={people} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 p-4">
            {cards.length === 0 ? "No opportunities yet." : search ? `No opportunities match "${search}".` : "No opportunities match this filter."}
          </p>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, filtered.length)} of {filtered.length} opportunities
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                disabled={clampedPage <= 1}
                className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={clsx(
                    "min-w-[1.75rem] rounded-md px-2 py-1",
                    n === clampedPage ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                disabled={clampedPage >= pageCount}
                className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]); setPage(1); }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function PresalesRow({
  p,
  canWrite,
  isAdmin,
  people,
}: {
  p: PresalesCardData;
  canWrite: boolean;
  isAdmin: boolean;
  people: { id: string; name: string }[];
}) {
  const isDeleted = p.deletedAt !== null;
  const badge = OUTCOME_BADGE[p.outcome];
  const subtitle = [p.industry, p.technology].filter(Boolean).join(" · ");

  const actions: RowAction[] = isDeleted
    ? [
        { label: "Restore", onClick: () => restorePresalesProject(p.id) },
        ...(isAdmin
          ? [{ label: "Delete Permanently", danger: true, confirmMessage: "Permanently delete this presales opportunity? This cannot be undone.", onClick: () => permanentlyDeletePresalesProject(p.id) }]
          : []),
      ]
    : [{ label: "Delete", danger: true, confirmMessage: "Delete this presales opportunity? It can be restored later from the Deleted filter.", onClick: () => deletePresalesProject(p.id) }];

  return (
    <tr className={clsx("border-b border-slate-50 last:border-0 hover:bg-slate-50/60", isDeleted && "opacity-60")}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(p.name) }}
          >
            {initials(p.name)}
          </span>
          <div className="min-w-0">
            <Link href={`/presales/${p.id}`} prefetch={false} className="block font-medium text-slate-800 hover:text-blue-600 hover:underline truncate" title={p.name}>
              {p.name}
            </Link>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{p.client || "—"}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {p.outcome === "OPEN" && canWrite ? (
          <PersonPicker
            personId={p.dealOwnerPersonId}
            legacyText={null}
            people={people}
            onSave={(id) => updatePresalesProject(p.id, { dealOwnerPersonId: id })}
          />
        ) : (
          <span className="text-slate-600">{p.dealOwnerPerson?.name ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {p.outcome === "OPEN" ? (
          canWrite ? (
            <InlineSelect
              value={p.stage}
              options={STAGE_ORDER}
              renderOption={(s) => PRESALES_STAGE_COLORS[s as PresalesStage].label}
              className="rounded-full border-0 px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: PRESALES_STAGE_COLORS[p.stage].bg, color: PRESALES_STAGE_COLORS[p.stage].text }}
              onSave={(v) => updatePresalesProject(p.id, { stage: v as PresalesStage })}
            />
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: PRESALES_STAGE_COLORS[p.stage].bg, color: PRESALES_STAGE_COLORS[p.stage].text }}
            >
              {PRESALES_STAGE_COLORS[p.stage].label}
            </span>
          )
        ) : (
          // Stage is meaningless once a deal is closed — show the outcome
          // instead of a stale in-flight stage.
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: badge.bg, color: badge.text }}>
            {p.outcome === "WON" ? "Won" : "Lost"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{p.estimatedValue ? formatByCurrency(p.estimatedValue, p.estimatedValueCurrency) : "—"}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
        {p.expectedCloseDate ? (
          <span className="inline-flex items-center gap-1.5" title={formatDate(p.expectedCloseDate)}>
            <IconCalendar className="h-3.5 w-3.5 text-slate-400" />
            {formatShortDate(p.expectedCloseDate)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {isDeleted ? (
          <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-xs font-medium">Deleted</span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: badge.bg, color: badge.text }}>
            {p.outcome === "OPEN" ? "Open" : p.outcome === "WON" ? "Won" : "Lost"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">{canWrite && <RowActionsMenu actions={actions} />}</td>
    </tr>
  );
}

function FilterPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label} ({count})
    </button>
  );
}
