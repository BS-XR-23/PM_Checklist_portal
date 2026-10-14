"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatDate, formatShortDate, formatPct } from "@/lib/format";
import { COMPLETED_STAGE_LABEL } from "@/lib/calculations";
import { PM_STAGES } from "@/lib/seed-data";
import { RAG_COLORS, RAG_LABELS, type Rag } from "@/lib/rag";
import { StatTile } from "@/components/ui/stat-tile";
import { IconSearch, IconGrid, IconClipboardList, IconFilter, IconLayers, IconGauge, IconDollar, IconAlertTriangle, IconCalendar } from "@/components/layout/icons";
import { ProjectActionsMenu } from "./project-actions-menu";
import type { PortfolioRow } from "@/lib/portfolio-data";

export type ProjectCardData = PortfolioRow & {
  endDate: Date | null; // derived — planned end, the latest client-milestone date (lib/milestones.ts)
  deletedAt: Date | null;
  overdueCount: number; // reminder items past due, empty for viewers who can't see Reminders
};

export type ProjectStats = {
  activeCount: number;
  health: Record<Rag, number>; // active projects only
  contractValue: number; // active projects only
  paid: number;
  overdueItems: number;
  avgDelivery: number | null; // mean Delivery % across active projects that have WBS points
  deliveryProjects: number;
};

// Brighter than RAG_COLORS' text tones (those are tuned for text on a pale
// pill) — used for the card's left edge and bar fills, where the colour has
// to read on white at a glance.
const HEALTH_ACCENT: Record<Rag, string> = { RED: "#DC2626", AMBER: "#F59E0B", GREEN: "#16A34A", NONE: "#94A3B8" };
// Worst first: Critical, At Risk, No data yet (unknown beats known-good),
// then Healthy.
const HEALTH_RANK: Record<Rag, number> = { RED: 3, AMBER: 2, NONE: 1, GREEN: 0 };

const STAGE_OPTIONS = [...PM_STAGES, COMPLETED_STAGE_LABEL];

type StatusFilter = "ACTIVE" | "ATTENTION" | "COMPLETED" | "ARCHIVED" | "ALL" | "DELETED";
const STATUS_FILTERS: { key: StatusFilter; label: string; title: string }[] = [
  { key: "ACTIVE", label: "Active", title: "Projects in progress" },
  { key: "ATTENTION", label: "Needs attention", title: "Active projects rated Critical or At Risk" },
  { key: "COMPLETED", label: "Completed", title: "Every tracked checklist item is done" },
  { key: "ARCHIVED", label: "Archived", title: "Archived by a Super Admin — read-only history" },
  { key: "ALL", label: "All", title: "Active and archived" },
];

function matchesStatusFilter(c: ProjectCardData, filter: StatusFilter): boolean {
  if (filter === "DELETED") return c.deletedAt !== null;
  if (c.deletedAt !== null) return false;
  switch (filter) {
    case "ACTIVE":
      return c.status === "ACTIVE";
    case "ATTENTION":
      return c.status === "ACTIVE" && (c.rag === "RED" || c.rag === "AMBER");
    case "COMPLETED":
      return c.stage === COMPLETED_STAGE_LABEL;
    case "ARCHIVED":
      return c.status === "ARCHIVED";
    case "ALL":
      return true;
  }
}

type SortKey = "health" | "name" | "delivery" | "milestone" | "value";
const SORT_LABELS: Record<SortKey, string> = {
  health: "Health (worst first)",
  name: "Name",
  delivery: "Delivery %",
  milestone: "Next milestone",
  value: "Contract value",
};

function compareCards(a: ProjectCardData, b: ProjectCardData, key: SortKey): number {
  switch (key) {
    case "health":
      return HEALTH_RANK[b.rag] - HEALTH_RANK[a.rag] || b.overdueCount - a.overdueCount || a.name.localeCompare(b.name);
    case "name":
      return a.name.localeCompare(b.name);
    case "delivery":
      return (b.deliveryPct ?? -1) - (a.deliveryPct ?? -1);
    case "milestone":
      return (a.nextMilestone?.date.getTime() ?? Infinity) - (b.nextMilestone?.date.getTime() ?? Infinity);
    case "value":
      return b.contractValue - a.contractValue;
  }
}

const VIEW_KEY = "projects:view";

/**
 * showInternals: false for Client/Guest viewers — they never see risk
 * counts (health reasons), money, or milestone/payment details here, same
 * rule the project Dashboard applies to READ_LIMITED viewers.
 */
export function ProjectFilters({
  cards,
  isAdmin,
  showInternals,
  stats,
}: {
  cards: ProjectCardData[];
  isAdmin: boolean;
  showInternals: boolean;
  stats: ProjectStats;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [pmFilter, setPmFilter] = useState<string>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [healthFilter, setHealthFilter] = useState<"ALL" | Rag>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("health");
  const [reverse, setReverse] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilterRow, setShowFilterRow] = useState(false);

  // View choice is a per-viewer convenience; storage can be blocked, so
  // every access is guarded and the grid is the fallback.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, []);
  const chooseView = (v: "grid" | "list") => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const chooseSort = (key: SortKey) => {
    if (key === sort) setReverse((r) => !r);
    else {
      setSort(key);
      setReverse(false);
    }
  };

  const pmOptions = useMemo(() => Array.from(new Set(cards.map((c) => c.pmName).filter((n): n is string => !!n))).sort(), [cards]);
  const clientOptions = useMemo(() => Array.from(new Set(cards.map((c) => c.client).filter((n): n is string => !!n))).sort(), [cards]);

  const q = search.trim().toLowerCase();
  // Every filter except the status pills, applied first — pill counts
  // reflect search/PM/client/stage/health together.
  const preFiltered = cards
    .filter((c) => stageFilter === "ALL" || c.stage === stageFilter)
    .filter((c) => pmFilter === "ALL" || c.pmName === pmFilter)
    .filter((c) => clientFilter === "ALL" || c.client === clientFilter)
    .filter((c) => healthFilter === "ALL" || c.rag === healthFilter)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.client ?? "").toLowerCase().includes(q) || (c.pmName ?? "").toLowerCase().includes(q));

  const visible = preFiltered
    .filter((c) => matchesStatusFilter(c, statusFilter))
    .sort((a, b) => {
      // Live projects always above archived ones, whatever the sort.
      const group = Number(a.status === "ARCHIVED") - Number(b.status === "ARCHIVED");
      if (group) return group;
      const cmp = compareCards(a, b, sort);
      return reverse ? -cmp : cmp;
    });

  const attention = stats.health.RED + stats.health.AMBER;
  const activeFilters = [stageFilter, pmFilter, clientFilter, healthFilter].filter((f) => f !== "ALL").length;

  return (
    <div className="space-y-5">
      <div className={clsx("grid grid-cols-1 sm:grid-cols-2 gap-4", showInternals ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatTile
          icon={<IconLayers />}
          iconWrapClass="bg-blue-100 text-blue-700"
          accentColor="#3b82f6"
          label="Active projects"
          value={String(stats.activeCount)}
          subtitle={<HealthSplit health={stats.health} />}
        />
        <button type="button" onClick={() => setStatusFilter("ATTENTION")} className="text-left" title="Show projects that need attention">
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass={attention ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}
            accentColor={attention ? HEALTH_ACCENT.RED : HEALTH_ACCENT.GREEN}
            label="Needs attention"
            value={String(attention)}
            valueColor={attention ? "#B91C1C" : undefined}
            subtitle={
              stats.overdueItems
                ? `${stats.overdueItems} overdue item${stats.overdueItems === 1 ? "" : "s"} across projects`
                : attention
                  ? "Critical or at-risk projects"
                  : "All active projects on track"
            }
          />
        </button>
        {showInternals && (
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-violet-100 text-violet-700"
            accentColor="#8b5cf6"
            label="Contract value in flight"
            value={formatMoney(stats.contractValue)}
            subtitle={stats.contractValue ? `${formatMoney(stats.paid)} paid (${formatPct(stats.paid / stats.contractValue)})` : "No contract values set"}
          />
        )}
        <StatTile
          icon={<IconGauge />}
          iconWrapClass="bg-emerald-100 text-emerald-700"
          accentColor="#10b981"
          label="Avg. delivery"
          value={stats.avgDelivery != null ? formatPct(stats.avgDelivery) : "—"}
          subtitle={stats.deliveryProjects ? `story points done, ${stats.deliveryProjects} project${stats.deliveryProjects === 1 ? "" : "s"} with a WBS` : "No WBS on active projects yet"}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <FilterPill
                key={f.key}
                label={f.label}
                title={f.title}
                count={preFiltered.filter((c) => matchesStatusFilter(c, f.key)).length}
                active={statusFilter === f.key}
                tone={f.key === "ATTENTION" ? "red" : undefined}
                onClick={() => setStatusFilter(f.key)}
              />
            ))}
            {isAdmin && (
              <FilterPill
                label="Deleted"
                title="Soft-deleted — restorable"
                count={preFiltered.filter((c) => matchesStatusFilter(c, "DELETED")).length}
                active={statusFilter === "DELETED"}
                onClick={() => setStatusFilter("DELETED")}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, client, or PM…"
              className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilterRow((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium",
              showFilterRow || activeFilters ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500">
            Sort
            <select value={sort} onChange={(e) => chooseSort(e.target.value as SortKey)} className="bg-transparent text-slate-700 focus:outline-none cursor-pointer">
              {(Object.keys(SORT_LABELS) as SortKey[]).filter((k) => showInternals || (k !== "value" && k !== "milestone")).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Project view">
            <ViewButton active={view === "grid"} onClick={() => chooseView("grid")} icon={<IconGrid className="h-3.5 w-3.5" />} label="Cards" />
            <ViewButton active={view === "list"} onClick={() => chooseView("list")} icon={<IconClipboardList className="h-3.5 w-3.5" />} label="Table" />
          </div>
        </div>

        {showFilterRow && (
          <div className="flex flex-wrap items-center gap-2">
            <LabeledSelect label="PM" value={pmFilter} onChange={setPmFilter} options={pmOptions} />
            <LabeledSelect label="Client" value={clientFilter} onChange={setClientFilter} options={clientOptions} />
            <LabeledSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={STAGE_OPTIONS} />
            <LabeledSelect
              label="Health"
              value={healthFilter}
              onChange={(v) => setHealthFilter(v as "ALL" | Rag)}
              options={["RED", "AMBER", "NONE", "GREEN"]}
              optionLabels={RAG_LABELS}
            />
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStageFilter("ALL");
                  setPmFilter("ALL");
                  setClientFilter("ALL");
                  setHealthFilter("ALL");
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {statusFilter === "ATTENTION" && !q && !activeFilters ? "Nothing needs attention — every active project is on track." : "No projects match these filters."}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ProjectCard key={p.id} p={p} isAdmin={isAdmin} showInternals={showInternals} />
            ))}
          </div>
        ) : (
          <ProjectTable rows={visible} isAdmin={isAdmin} showInternals={showInternals} sort={sort} reverse={reverse} onSort={chooseSort} />
        )}
      </div>
    </div>
  );
}

function HealthSplit({ health }: { health: Record<Rag, number> }) {
  const order: Rag[] = ["RED", "AMBER", "NONE", "GREEN"];
  const total = order.reduce((s, r) => s + health[r], 0);
  if (!total) return <span>None in progress</span>;
  return (
    <span className="block">
      <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        {order.map((r) => (health[r] ? <span key={r} style={{ width: `${(health[r] / total) * 100}%`, backgroundColor: HEALTH_ACCENT[r] }} /> : null))}
      </span>
      <span className="mt-1 block">
        {order
          .filter((r) => health[r])
          .map((r) => `${health[r]} ${RAG_LABELS[r].toLowerCase()}`)
          .join(" · ")}
      </span>
    </span>
  );
}

function HealthPill({ rag, className }: { rag: Rag; className?: string }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", className)}
      style={{ backgroundColor: RAG_COLORS[rag].bg, color: RAG_COLORS[rag].text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RAG_COLORS[rag].text }} />
      {RAG_LABELS[rag]}
    </span>
  );
}

function healthNote(p: ProjectCardData, showInternals: boolean): string | null {
  if (p.status === "ARCHIVED") return null;
  if (!showInternals) return null;
  if (p.rag === "NONE") return "Add a client milestone, start a sprint, or log risks to rate health";
  return p.healthReasons.length ? p.healthReasons.join(" · ") : null;
}

function StageChip({ stage }: { stage: string }) {
  const done = stage === COMPLETED_STAGE_LABEL;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"
      )}
      title="Current PM checklist stage"
    >
      {done ? "✓ Completed" : stage}
    </span>
  );
}

function ProgressBar({ label, value, color, hint, empty }: { label: string; value: number | null; color: string; hint: string; empty: string }) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className="font-semibold text-slate-700">{value != null ? formatPct(value) : <span className="font-normal text-slate-400">{empty}</span>}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(1, value ?? 0) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function NextMilestone({ m, compact }: { m: ProjectCardData["nextMilestone"]; compact?: boolean }) {
  if (!m) return <span className="text-slate-400">{compact ? "—" : "None scheduled"}</span>;
  const overdue = isPast(m.date);
  return (
    <span className="block min-w-0" title={`${m.name} — ${formatDate(m.date)}${m.owner ? ` · ${m.owner}` : ""}`}>
      <span className="block truncate font-medium text-slate-700">{m.name}</span>
      <span className={clsx("inline-flex items-center gap-1 text-[11px]", overdue ? "font-semibold text-red-600" : "text-slate-400")}>
        <IconCalendar className="h-3 w-3" />
        {formatShortDate(m.date)}
        {overdue && " · overdue"}
      </span>
    </span>
  );
}

function Money({ p }: { p: ProjectCardData }) {
  if (p.contractValue <= 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="block">
      <span className="block font-medium text-slate-700">{formatMoney(p.contractValue)}</span>
      <span className="text-[11px] text-slate-400">{p.paidAmount > 0 ? `${formatPct(p.paidAmount / p.contractValue)} paid` : "nothing paid yet"}</span>
    </span>
  );
}

function ProjectCard({ p, isAdmin, showInternals }: { p: ProjectCardData; isAdmin: boolean; showInternals: boolean }) {
  const isDeleted = p.deletedAt !== null;
  const archived = p.status === "ARCHIVED";
  const accent = isDeleted || archived ? "#CBD5E1" : HEALTH_ACCENT[p.rag];
  const note = healthNote(p, showInternals);

  return (
    <article
      className={clsx(
        "group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all",
        !isDeleted && "hover:shadow-md hover:border-slate-300",
        (isDeleted || archived) && "opacity-70"
      )}
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {isDeleted ? (
            <h3 className="font-semibold leading-snug text-slate-900">{p.name}</h3>
          ) : (
            // Stretched link: the whole card navigates, while the actions
            // menu (outside the <a>) stays a separate, valid control.
            <Link href={`/projects/${p.id}/dashboard`} prefetch={false} className="font-semibold leading-snug text-slate-900 hover:text-blue-700 after:absolute after:inset-0">
              {p.name}
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {p.client ?? "No client"} · PM {p.pmName ?? <span className="text-amber-700">unassigned</span>}
          </p>
        </div>
        {isAdmin && (
          <div className="relative z-10">
            <ProjectActionsMenu projectId={p.id} projectName={p.name} status={p.status} isDeleted={isDeleted} />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {isDeleted ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Deleted</span>
        ) : archived ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Archived</span>
        ) : (
          <HealthPill rag={p.rag} />
        )}
        <StageChip stage={p.stage} />
        {p.overdueCount > 0 && (
          <span
            className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
            title={`${p.overdueCount} checklist or action item${p.overdueCount > 1 ? "s" : ""} past their date`}
          >
            ⚠ {p.overdueCount} overdue
          </span>
        )}
      </div>
      {note && (
        <p className={clsx("mt-1.5 text-xs", p.rag === "RED" ? "text-red-700" : p.rag === "AMBER" ? "text-amber-800" : "text-slate-500")}>{note}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-2.5">
        <ProgressBar label="Governance" value={p.progress} color="#6366F1" hint="Checklist items completed, across every checklist" empty="—" />
        <ProgressBar label="Delivery" value={p.deliveryPct} color={HEALTH_ACCENT[p.rag === "NONE" ? "GREEN" : p.rag]} hint="Story points done of total WBS points (Delivery → Tasks)" empty="No WBS" />
      </div>

      <div className={clsx("mt-3 grid gap-2 text-xs", showInternals ? "grid-cols-3" : "grid-cols-1")}>
        <div title="Story points earned ÷ committed across started sprints">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">SPI</p>
          <p className={clsx("mt-0.5 font-semibold", p.latestSpi == null ? "text-slate-400" : p.latestSpi < 0.9 ? "text-red-600" : p.latestSpi < 1 ? "text-amber-700" : "text-emerald-700")}>
            {p.latestSpi != null ? p.latestSpi.toFixed(2) : "—"}
          </p>
        </div>
        {showInternals && (
          <>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Next milestone</p>
              <div className="mt-0.5">
                <NextMilestone m={p.nextMilestone} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Contract</p>
              <div className="mt-0.5">
                <Money p={p} />
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function ProjectTable({
  rows,
  isAdmin,
  showInternals,
  sort,
  reverse,
  onSort,
}: {
  rows: ProjectCardData[];
  isAdmin: boolean;
  showInternals: boolean;
  sort: SortKey;
  reverse: boolean;
  onSort: (k: SortKey) => void;
}) {
  const Th = ({ label, k, className }: { label: string; k?: SortKey; className?: string }) => (
    <th className={clsx("px-3 py-2.5 font-medium whitespace-nowrap", className)} aria-sort={k && sort === k ? (reverse ? "ascending" : "descending") : undefined}>
      {k ? (
        <button type="button" onClick={() => onSort(k)} className={clsx("inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700", sort === k && "text-slate-700")}>
          {label}
          <span className="text-[9px]">{sort === k ? (reverse ? "▲" : "▼") : ""}</span>
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <Th label="Project" k="name" />
            <Th label="Health" k="health" />
            <Th label="Stage" />
            <Th label="Governance" />
            <Th label="Delivery" k="delivery" />
            <Th label="SPI" />
            {showInternals && <Th label="Next milestone" k="milestone" />}
            {showInternals && <Th label="Contract" k="value" className="text-right" />}
            {isAdmin && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const isDeleted = p.deletedAt !== null;
            const archived = p.status === "ARCHIVED";
            const note = healthNote(p, showInternals);
            return (
              <tr key={p.id} className={clsx("border-b border-slate-50 last:border-0 hover:bg-slate-50/60", (isDeleted || archived) && "opacity-70")}>
                <td className="px-3 py-2.5 max-w-[260px]" style={{ boxShadow: `inset 4px 0 0 ${isDeleted || archived ? "#CBD5E1" : HEALTH_ACCENT[p.rag]}` }}>
                  {isDeleted ? (
                    <p className="truncate font-medium text-slate-800">{p.name}</p>
                  ) : (
                    <Link href={`/projects/${p.id}/dashboard`} prefetch={false} className="block truncate font-medium text-slate-800 hover:text-blue-700 hover:underline" title={p.name}>
                      {p.name}
                    </Link>
                  )}
                  <p className="truncate text-xs text-slate-400">
                    {p.client ?? "No client"} · {p.pmName ?? "No PM"}
                  </p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap" title={note ?? "No issues found"}>
                  {isDeleted ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Deleted</span>
                  ) : archived ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Archived</span>
                  ) : (
                    <div>
                      <HealthPill rag={p.rag} />
                      {p.overdueCount > 0 && <span className="ml-1 text-[11px] font-semibold text-red-600">⚠ {p.overdueCount}</span>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StageChip stage={p.stage} />
                </td>
                <td className="px-3 py-2.5 w-32">
                  <ProgressBar label="" value={p.progress} color="#6366F1" hint="Checklist items completed" empty="—" />
                </td>
                <td className="px-3 py-2.5 w-32">
                  <ProgressBar label="" value={p.deliveryPct} color={HEALTH_ACCENT[p.rag === "NONE" ? "GREEN" : p.rag]} hint="Story points done of total WBS points" empty="No WBS" />
                </td>
                <td className={clsx("px-3 py-2.5 font-semibold", p.latestSpi == null ? "text-slate-400" : p.latestSpi < 0.9 ? "text-red-600" : p.latestSpi < 1 ? "text-amber-700" : "text-emerald-700")}>
                  {p.latestSpi != null ? p.latestSpi.toFixed(2) : "—"}
                </td>
                {showInternals && (
                  <td className="px-3 py-2.5 max-w-[200px] text-xs">
                    <NextMilestone m={p.nextMilestone} compact />
                  </td>
                )}
                {showInternals && (
                  <td className="px-3 py-2.5 text-right text-xs">
                    <Money p={p} />
                  </td>
                )}
                {isAdmin && (
                  <td className="px-2 py-2.5">
                    <ProjectActionsMenu projectId={p.id} projectName={p.name} status={p.status} isDeleted={isDeleted} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
    >
      {icon}
      {label}
    </button>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-2.5 pr-1.5 py-1.5 text-xs font-medium text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-slate-700 focus:outline-none cursor-pointer">
        <option value="ALL">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabels?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterPill({
  label,
  title,
  active,
  onClick,
  count,
  tone,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: "red";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? tone === "red"
            ? "bg-red-600 text-white border-red-600"
            : "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.1rem] text-[10px] font-semibold",
          active ? "bg-white/20 text-white" : tone === "red" && count > 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}
