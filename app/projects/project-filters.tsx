"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatDate, formatShortDate, formatPct } from "@/lib/format";
import { COMPLETED_STAGE_LABEL } from "@/lib/calculations";
import { PM_STAGES } from "@/lib/seed-data";
import { RAG_COLORS, type Rag } from "@/lib/rag";
import { StatTile } from "@/components/ui/stat-tile";
import { IconSearch, IconGrid, IconClipboardList, IconFilter, IconLayers, IconCheckCircle, IconAlertTriangle, IconAlertCircle, IconDollar } from "@/components/layout/icons";
import { ProjectActionsMenu } from "./project-actions-menu";
import { NewProjectForm } from "./new-project-form";
import type { ProjectStatus } from "@prisma/client";

export type ProjectCardData = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  pmName: string | null;
  stage: string;
  progress: number;
  contractValue: number;
  rag: Rag;
  latestSpi: number | null;
  latestCpi: number | null;
  openRisks: number;
  createdAt: Date;
  endDate: Date | null; // derived — latest Actual Date across the checklist
  deletedAt: Date | null;
  overdueCount: number; // items past their Planned Date, empty for viewers who can't see Reminders
};

export type ProjectStats = {
  totalProjects: number;
  activeCount: number;
  healthy: number;
  atRisk: number;
  critical: number;
  totalContractValue: number;
  newIn30Days: number;
};

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

const HEALTH_BADGE: Record<Rag, { label: string; bg: string; text: string }> = {
  GREEN: { label: "Healthy", bg: RAG_COLORS.GREEN.bg, text: RAG_COLORS.GREEN.text },
  AMBER: { label: "At Risk", bg: RAG_COLORS.AMBER.bg, text: RAG_COLORS.AMBER.text },
  RED: { label: "Critical", bg: RAG_COLORS.RED.bg, text: RAG_COLORS.RED.text },
};

const STAGE_OPTIONS = [...PM_STAGES, COMPLETED_STAGE_LABEL];

type StatusFilter = "ALL" | "ACTIVE" | "AT_RISK" | "CRITICAL" | "COMPLETED" | "ARCHIVED" | "DELETED";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All Projects" },
  { key: "ACTIVE", label: "Active" },
  { key: "AT_RISK", label: "At Risk" },
  { key: "CRITICAL", label: "Critical" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ARCHIVED", label: "Archived" },
];

function matchesStatusFilter(c: ProjectCardData, filter: StatusFilter): boolean {
  switch (filter) {
    case "ALL":
      return c.deletedAt === null;
    case "ACTIVE":
      return c.deletedAt === null && c.status === "ACTIVE";
    case "AT_RISK":
      return c.deletedAt === null && c.status === "ACTIVE" && c.rag === "AMBER";
    case "CRITICAL":
      return c.deletedAt === null && c.status === "ACTIVE" && c.rag === "RED";
    case "COMPLETED":
      return c.deletedAt === null && c.stage === COMPLETED_STAGE_LABEL;
    case "ARCHIVED":
      return c.deletedAt === null && c.status === "ARCHIVED";
    case "DELETED":
      return c.deletedAt !== null;
  }
}

// Purely illustrative (no historical snapshot stored to compare against) —
// up for any non-zero count, flat for zero. Total Contract Value gets no
// arrow at all (a dollar total "trending" needs a prior-period baseline
// this app doesn't keep, unlike the others which are simple ratios of
// already-known numbers).
function Trend({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <span className="text-emerald-500">↑</span>
    </span>
  );
}

export function ProjectFilters({
  cards,
  isAdmin,
  canSeeAll,
  stats,
}: {
  cards: ProjectCardData[];
  isAdmin: boolean;
  canSeeAll: boolean;
  stats: ProjectStats;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [pmFilter, setPmFilter] = useState<string>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [healthFilter, setHealthFilter] = useState<"ALL" | Rag>("ALL");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilterRow, setShowFilterRow] = useState(true);

  const pmOptions = Array.from(new Set(cards.map((c) => c.pmName).filter((n): n is string => !!n))).sort();
  const clientOptions = Array.from(new Set(cards.map((c) => c.client).filter((n): n is string => !!n))).sort();

  const q = search.trim().toLowerCase();
  // Every filter except the status/health pill row, applied first — pill
  // counts below reflect search/PM/client/stage/health together, so
  // switching pills always shows accurate counts for whatever else is
  // filtered.
  const preFiltered = cards
    .filter((c) => stageFilter === "ALL" || c.stage === stageFilter)
    .filter((c) => pmFilter === "ALL" || c.pmName === pmFilter)
    .filter((c) => clientFilter === "ALL" || c.client === clientFilter)
    .filter((c) => healthFilter === "ALL" || c.rag === healthFilter)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.client ?? "").toLowerCase().includes(q) || (c.pmName ?? "").toLowerCase().includes(q));

  const visible = preFiltered.filter((c) => matchesStatusFilter(c, statusFilter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {canSeeAll && (
            <Link href="/portfolio" prefetch={false} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
              ← Portfolio
            </Link>
          )}
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 max-w-xl">Manage and track all projects across different stages — from presales to delivery.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, client, or PM…"
              className="w-64 rounded-md border border-slate-200 pl-8 pr-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilterRow((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium",
              showFilterRow ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filters
          </button>
          {isAdmin && <NewProjectForm />}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile
          icon={<IconGrid />}
          iconWrapClass="bg-blue-100 text-blue-700"
          bgClass="bg-blue-50/60"
          accentColor="#3b82f6"
          label="Total Projects"
          value={String(stats.totalProjects)}
          subtitle={stats.newIn30Days > 0 ? <Trend text={`${stats.newIn30Days} in the last 30 days`} /> : undefined}
        />
        <StatTile
          icon={<IconLayers />}
          iconWrapClass="bg-indigo-100 text-indigo-700"
          bgClass="bg-indigo-50/60"
          accentColor="#6366f1"
          label="Active"
          value={String(stats.activeCount)}
          subtitle={stats.totalProjects ? <Trend text={`${formatPct(stats.activeCount / stats.totalProjects)} of total`} /> : undefined}
        />
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-100 text-emerald-700"
          bgClass="bg-emerald-50/60"
          accentColor="#10b981"
          label="Healthy"
          value={String(stats.healthy)}
          subtitle={stats.activeCount ? <Trend text={`${formatPct(stats.healthy / stats.activeCount)} of active`} /> : undefined}
        />
        <StatTile
          icon={<IconAlertTriangle />}
          iconWrapClass="bg-amber-100 text-amber-700"
          bgClass="bg-amber-50/60"
          accentColor="#f59e0b"
          label="At Risk"
          value={String(stats.atRisk)}
          subtitle={stats.activeCount ? <Trend text={`${formatPct(stats.atRisk / stats.activeCount)} of active`} /> : undefined}
        />
        <StatTile
          icon={<IconAlertCircle />}
          iconWrapClass="bg-red-100 text-red-700"
          bgClass="bg-red-50/60"
          accentColor="#ef4444"
          label="Critical"
          value={String(stats.critical)}
          subtitle={stats.activeCount ? <Trend text={`${formatPct(stats.critical / stats.activeCount)} of active`} /> : undefined}
        />
        <StatTile
          icon={<IconDollar />}
          iconWrapClass="bg-violet-100 text-violet-700"
          bgClass="bg-violet-50/60"
          accentColor="#8b5cf6"
          label="Total Contract Value"
          value={formatMoney(stats.totalContractValue)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <FilterPill
                key={f.key}
                label={f.label}
                count={preFiltered.filter((c) => matchesStatusFilter(c, f.key)).length}
                active={statusFilter === f.key}
                onClick={() => setStatusFilter(f.key)}
              />
            ))}
            {isAdmin && (
              <FilterPill
                label="Deleted"
                count={preFiltered.filter((c) => matchesStatusFilter(c, "DELETED")).length}
                active={statusFilter === "DELETED"}
                onClick={() => setStatusFilter("DELETED")}
              />
            )}
          </div>

          <div className="ml-auto flex items-center rounded-md border border-slate-200 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              title="Grid view"
              className={clsx("p-1.5", view === "grid" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-700")}
            >
              <IconGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              title="List view"
              className={clsx("p-1.5", view === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-700")}
            >
              <IconClipboardList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showFilterRow && (
          <div className="flex flex-wrap items-center gap-2">
            <LabeledSelect label="PM" value={pmFilter} onChange={setPmFilter} options={pmOptions} allLabel="All" />
            <LabeledSelect label="Client" value={clientFilter} onChange={setClientFilter} options={clientOptions} allLabel="All" />
            <LabeledSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={STAGE_OPTIONS} allLabel="All" />
            <LabeledSelect
              label="Health"
              value={healthFilter}
              onChange={(v) => setHealthFilter(v as "ALL" | Rag)}
              options={["GREEN", "AMBER", "RED"]}
              optionLabels={{ GREEN: "Healthy", AMBER: "At Risk", RED: "Critical" }}
              allLabel="All"
            />
          </div>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">No projects match this filter.</p>
        ) : view === "grid" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ProjectCard key={p.id} p={p} isAdmin={isAdmin} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((p) => (
              <ProjectListRow key={p.id} p={p} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
  allLabel: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-2.5 pr-1.5 py-1.5 text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
      >
        <option value="ALL">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabels?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectCard({ p, isAdmin }: { p: ProjectCardData; isAdmin: boolean }) {
  const color = avatarColor(p.id);
  const isDeleted = p.deletedAt !== null;
  const health = HEALTH_BADGE[p.rag];
  // Left-edge stripe in the project's own RAG color — reuses RAG_COLORS'
  // text color (already the progress bar's fill color below) rather than
  // introducing a new hue, so a card's health reads at a glance across a
  // whole grid of them. Inline style, not a border-l-{color} utility: a
  // `border-l-{color}` class can lose to this card's own `border-slate-200`
  // depending on Tailwind's generated CSS order — inline style always wins.
  const ragBorder = { borderLeftColor: RAG_COLORS[p.rag].text, borderLeftWidth: 4 };

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0"
            style={{ backgroundColor: color.bg, color: color.text }}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="font-medium text-slate-900 truncate" title={p.name}>
              {p.name}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              Client: {p.client ?? "—"} | PM: {p.pmName ?? "Unassigned"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.overdueCount > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: RAG_COLORS.RED.bg, color: RAG_COLORS.RED.text }}
              title={`${p.overdueCount} checklist item${p.overdueCount > 1 ? "s" : ""} past their Planned Date`}
            >
              ⚠ {p.overdueCount} overdue
            </span>
          )}
          {isDeleted ? (
            <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">Deleted</span>
          ) : p.status === "ARCHIVED" ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">Archived</span>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: health.bg, color: health.text }}
            >
              {health.label}
            </span>
          )}
          {isAdmin && <ProjectActionsMenu projectId={p.id} projectName={p.name} status={p.status} isDeleted={isDeleted} />}
        </div>
      </div>

      <div className="mt-2.5 h-0.5 w-12 rounded-full" style={{ backgroundColor: RAG_COLORS[p.rag].text }} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Stage</p>
          <p className="text-slate-700 font-medium truncate mt-0.5">{p.stage}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Progress</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full" style={{ width: `${p.progress * 100}%`, backgroundColor: RAG_COLORS[p.rag].text }} />
            </div>
            <span className="text-slate-500 shrink-0">{formatPct(p.progress)}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Contract Value</p>
          <p className="text-slate-700 font-medium truncate mt-0.5">{p.contractValue > 0 ? formatMoney(p.contractValue) : "—"}</p>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
        <StatChip label="SPI" value={p.latestSpi != null ? p.latestSpi.toFixed(2) : "—"} />
        <StatChip label="CPI" value={p.latestCpi != null ? p.latestCpi.toFixed(2) : "—"} />
        <StatChip label="Open Risks" value={String(p.openRisks)} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400" title={formatDate(p.createdAt)}>
          {formatShortDate(p.createdAt)} → {p.endDate ? formatShortDate(p.endDate) : "—"}
        </span>
        {/* Visual affordance only, not a separate interactive element — the
            whole card is already the <Link>; nesting a real <a>/<button>
            inside it would be invalid HTML and would fight the card's own
            click target. */}
        {!isDeleted && (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
            View Project →
          </span>
        )}
      </div>
    </>
  );

  if (isDeleted) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 opacity-60" style={ragBorder}>
        {cardBody}
      </div>
    );
  }

  return (
    <Link
      href={`/projects/${p.id}/dashboard`}
      prefetch={false}
      style={ragBorder}
      className={clsx(
        "block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all",
        p.status === "ARCHIVED" && "opacity-60"
      )}
    >
      {cardBody}
    </Link>
  );
}

function ProjectListRow({ p, isAdmin }: { p: ProjectCardData; isAdmin: boolean }) {
  const color = avatarColor(p.id);
  const isDeleted = p.deletedAt !== null;
  const health = HEALTH_BADGE[p.rag];
  const ragBorder = { borderLeftColor: RAG_COLORS[p.rag].text, borderLeftWidth: 4 };

  const rowBody = (
    <>
      <span
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {p.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 w-36 shrink-0">
        <p className="font-medium text-slate-900 truncate text-sm" title={p.name}>
          {p.name}
        </p>
        <p className="text-xs text-slate-400 truncate">{p.client ?? "No client"}</p>
      </div>
      <p className="w-20 shrink-0 truncate text-xs text-slate-500">{p.pmName ?? "Unassigned"}</p>
      <p className="w-20 shrink-0 truncate text-xs text-slate-500">{p.stage}</p>
      <div className="flex-1 min-w-[70px] flex items-center gap-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full" style={{ width: `${p.progress * 100}%`, backgroundColor: RAG_COLORS[p.rag].text }} />
        </div>
        <span className="text-xs font-medium text-slate-500 shrink-0 w-8 text-right">{formatPct(p.progress)}</span>
      </div>
      <p className="w-20 shrink-0 text-right text-xs text-slate-500" title={`SPI ${p.latestSpi != null ? p.latestSpi.toFixed(2) : "—"} / CPI ${p.latestCpi != null ? p.latestCpi.toFixed(2) : "—"}`}>
        {p.latestSpi != null ? p.latestSpi.toFixed(2) : "—"}/{p.latestCpi != null ? p.latestCpi.toFixed(2) : "—"}
      </p>
      <p className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">{p.contractValue > 0 ? formatMoney(p.contractValue) : "—"}</p>
      <div className="w-20 shrink-0 flex justify-end">
        {isDeleted ? (
          <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[11px] font-medium">Deleted</span>
        ) : p.status === "ARCHIVED" ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-medium">Archived</span>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
            style={{ backgroundColor: health.bg, color: health.text }}
          >
            {health.label}
          </span>
        )}
      </div>
      {isAdmin && <ProjectActionsMenu projectId={p.id} projectName={p.name} status={p.status} isDeleted={isDeleted} />}
    </>
  );

  if (isDeleted) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 opacity-60" style={ragBorder}>
        {rowBody}
      </div>
    );
  }

  return (
    <Link
      href={`/projects/${p.id}/dashboard`}
      prefetch={false}
      style={ragBorder}
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-400 hover:shadow-sm transition-all",
        p.status === "ARCHIVED" && "opacity-60"
      )}
    >
      {rowBody}
    </Link>
  );
}

function FilterPill({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.1rem] text-[10px] font-semibold",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatChip({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5" title={title}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium truncate">{value}</p>
    </div>
  );
}
