"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatShortDate, formatDateTime, initials } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { INDEX_BAND_COLORS, indexBand, avatarColorFromString } from "@/lib/colors";
import { IconSearch, IconDotsVertical, IconChevronDown, IconX } from "@/components/layout/icons";
import type { PortfolioRow, PortfolioSummary, FinancialStatus } from "@/lib/portfolio-data";
import { StatTile } from "@/components/ui/stat-tile";
import { IconGrid, IconTarget, IconCheckCircle, IconAlertTriangle, IconAlertCircle, IconDollar } from "@/components/layout/icons";

type Tab = "ALL" | "ACTIVE" | "HEALTHY" | "AT_RISK" | "CRITICAL" | "COMPLETED";
const TAB_LABEL: Record<Tab, string> = {
  ALL: "All Projects",
  ACTIVE: "Active",
  HEALTHY: "Healthy",
  AT_RISK: "At Risk",
  CRITICAL: "Critical",
  COMPLETED: "Completed",
};

function matchesTab(r: PortfolioRow, tab: Tab): boolean {
  switch (tab) {
    case "ALL":
      return true;
    case "ACTIVE":
      return r.status === "ACTIVE";
    case "HEALTHY":
      return r.status === "ACTIVE" && r.rag === "GREEN";
    case "AT_RISK":
      return r.rag === "AMBER";
    case "CRITICAL":
      return r.rag === "RED";
    case "COMPLETED":
      return r.stage === "Completed";
  }
}

const FINANCIAL_STATUS_LABEL: Record<FinancialStatus, string> = {
  NOT_INVOICED: "Not Invoiced",
  OUTSTANDING: "Outstanding",
  PAID: "Fully Paid",
};

type RiskFilter = "ALL" | "HAS_RISKS" | "NO_RISKS";
type DateRange = "ALL" | "7" | "30" | "90";
type SortKey = "health" | "progress" | "contractValue" | "spi" | "cpi" | "risks" | "nextMilestone" | "updatedAt";
type SortDir = "asc" | "desc";

const HEALTH_RANK: Record<PortfolioRow["rag"], number> = { RED: 3, AMBER: 2, GREEN: 1 };

function compareRows(a: PortfolioRow, b: PortfolioRow, key: SortKey): number {
  switch (key) {
    case "health":
      return HEALTH_RANK[a.rag] - HEALTH_RANK[b.rag];
    case "progress":
      return a.progress - b.progress;
    case "contractValue":
      return a.contractValue - b.contractValue;
    case "spi":
      return (a.latestSpi ?? -1) - (b.latestSpi ?? -1);
    case "cpi":
      return (a.latestCpi ?? -1) - (b.latestCpi ?? -1);
    case "risks":
      return a.openRisks - b.openRisks;
    case "nextMilestone":
      return (a.nextMilestone?.date.getTime() ?? Infinity) - (b.nextMilestone?.date.getTime() ?? Infinity);
    case "updatedAt":
      return a.updatedAt.getTime() - b.updatedAt.getTime();
  }
}

export function PortfolioClient({
  rows,
  summary,
  middleContent,
}: {
  rows: PortfolioRow[];
  summary: PortfolioSummary;
  middleContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [pmFilter, setPmFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [financialFilter, setFinancialFilter] = useState<"ALL" | FinancialStatus>("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  function selectTab(next: Tab) {
    setTab(next);
    document.getElementById("project-portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectOutstanding() {
    setFinancialFilter("OUTSTANDING");
    document.getElementById("project-portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pmOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.pmName).filter((v): v is string => !!v))).sort(), [rows]);
  const clientOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.client).filter((v): v is string => !!v))).sort(), [rows]);
  const stageOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.stage))).sort(), [rows]);

  const q = search.trim().toLowerCase();
  const now = Date.now();
  const rangeDays = dateRange === "ALL" ? null : Number(dateRange);

  const filtered = rows
    .filter((r) => matchesTab(r, tab))
    .filter((r) => pmFilter === "ALL" || r.pmName === pmFilter)
    .filter((r) => clientFilter === "ALL" || r.client === clientFilter)
    .filter((r) => stageFilter === "ALL" || r.stage === stageFilter)
    .filter((r) => financialFilter === "ALL" || r.financialStatus === financialFilter)
    .filter((r) => riskFilter === "ALL" || (riskFilter === "HAS_RISKS" ? r.openRisks > 0 : r.openRisks === 0))
    .filter((r) => rangeDays == null || now - r.updatedAt.getTime() <= rangeDays * 86400000)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.client ?? "").toLowerCase().includes(q) || (r.pmName ?? "").toLowerCase().includes(q));

  const sorted = sort ? [...filtered].sort((a, b) => (compareRows(a, b, sort.key) * (sort.dir === "asc" ? 1 : -1))) : filtered;

  const tabCount = (t: Tab) => rows.filter((r) => matchesTab(r, t)).length;

  const activeFilters: { label: string; onClear: () => void }[] = [];
  if (tab !== "ALL") activeFilters.push({ label: TAB_LABEL[tab], onClear: () => setTab("ALL") });
  if (pmFilter !== "ALL") activeFilters.push({ label: `PM: ${pmFilter}`, onClear: () => setPmFilter("ALL") });
  if (clientFilter !== "ALL") activeFilters.push({ label: `Client: ${clientFilter}`, onClear: () => setClientFilter("ALL") });
  if (stageFilter !== "ALL") activeFilters.push({ label: `Stage: ${stageFilter}`, onClear: () => setStageFilter("ALL") });
  if (financialFilter !== "ALL") activeFilters.push({ label: FINANCIAL_STATUS_LABEL[financialFilter], onClear: () => setFinancialFilter("ALL") });
  if (riskFilter !== "ALL") activeFilters.push({ label: riskFilter === "HAS_RISKS" ? "Has Open Risks" : "No Open Risks", onClear: () => setRiskFilter("ALL") });
  if (dateRange !== "ALL") activeFilters.push({ label: `Updated in last ${dateRange}d`, onClear: () => setDateRange("ALL") });

  function clearAll() {
    setTab("ALL");
    setPmFilter("ALL");
    setClientFilter("ALL");
    setStageFilter("ALL");
    setFinancialFilter("ALL");
    setRiskFilter("ALL");
    setDateRange("ALL");
    setSearch("");
  }

  return (
    <>
      {/* KPIs */}
      {/* 2 rows of 4, not 1 row of 8 — 8-across leaves each card too narrow
          for labels like "Contract Value" to sit on one line at normal
          desktop widths, which throws off the row's icon/value alignment. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard onClick={() => selectTab("ALL")}>
          <StatTile icon={<IconGrid />} iconWrapClass="bg-slate-100 text-slate-600" label="Total Projects" value={String(summary.totalProjects)} nowrap accentColor="#94A3B8" />
        </KpiCard>
        <KpiCard onClick={() => selectTab("ACTIVE")} active={tab === "ACTIVE"}>
          <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="Active" value={String(summary.activeProjects)} nowrap accentColor="#3B82F6" />
        </KpiCard>
        <KpiCard onClick={() => selectTab("HEALTHY")} active={tab === "HEALTHY"}>
          <StatTile
            icon={<IconCheckCircle />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Healthy"
            value={String(summary.healthy)}
            valueColor={RAG_COLORS.GREEN.text}
            nowrap
            accentColor={RAG_COLORS.GREEN.text}
          />
        </KpiCard>
        <KpiCard onClick={() => selectTab("AT_RISK")} active={tab === "AT_RISK"}>
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="At Risk"
            value={String(summary.atRisk)}
            valueColor={RAG_COLORS.AMBER.text}
            nowrap
            accentColor={RAG_COLORS.AMBER.text}
          />
        </KpiCard>
        <KpiCard onClick={() => selectTab("CRITICAL")} active={tab === "CRITICAL"}>
          <StatTile
            icon={<IconAlertCircle />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Critical"
            value={String(summary.critical)}
            valueColor={RAG_COLORS.RED.text}
            nowrap
            accentColor={RAG_COLORS.RED.text}
          />
        </KpiCard>
        <KpiCard>
          <StatTile icon={<IconDollar />} iconWrapClass="bg-indigo-50 text-indigo-600" label="Contract Value" value={formatMoney(summary.totalContractValue)} nowrap accentColor="#6366F1" />
        </KpiCard>
        <KpiCard>
          <StatTile icon={<IconDollar />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Collected" value={formatMoney(summary.collected)} nowrap accentColor="#10B981" />
        </KpiCard>
        <KpiCard onClick={selectOutstanding} active={financialFilter === "OUTSTANDING"}>
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Outstanding"
            value={formatMoney(summary.outstanding)}
            subtitle={summary.outstanding === 0 ? "No invoices outstanding" : `${Math.round((summary.outstanding / (summary.totalContractValue || 1)) * 100)}% of contract value`}
            accentColor="#F59E0B"
            nowrap
          />
        </KpiCard>
      </div>

      {middleContent}

      {/* Project Portfolio */}
      <div id="project-portfolio" className="scroll-mt-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Project Portfolio</h2>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                  tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                )}
              >
                {TAB_LABEL[t]} <span className={tab === t ? "text-slate-300" : "text-slate-400"}>({tabCount(t)})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="PM" value={pmFilter} onChange={setPmFilter} options={pmOptions} />
            <FilterSelect label="Client" value={clientFilter} onChange={setClientFilter} options={clientOptions} />
            <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={stageOptions} />
            <FilterSelect
              label="Financial"
              value={financialFilter}
              onChange={(v) => setFinancialFilter(v as "ALL" | FinancialStatus)}
              options={["NOT_INVOICED", "OUTSTANDING", "PAID"]}
              renderOption={(v) => FINANCIAL_STATUS_LABEL[v as FinancialStatus]}
            />
            <FilterSelect
              label="Risk"
              value={riskFilter}
              onChange={(v) => setRiskFilter(v as RiskFilter)}
              options={["HAS_RISKS", "NO_RISKS"]}
              renderOption={(v) => (v === "HAS_RISKS" ? "Has Open Risks" : "No Open Risks")}
            />
            <FilterSelect
              label="Updated"
              value={dateRange}
              onChange={(v) => setDateRange(v as DateRange)}
              options={["7", "30", "90"]}
              renderOption={(v) => `Last ${v} days`}
            />
            <div className="relative ml-auto">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-56 rounded-md border border-slate-200 pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5">
              <span className="text-xs text-slate-500">Filtered by:</span>
              {activeFilters.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {f.label}
                  <button type="button" onClick={f.onClear} aria-label={`Clear ${f.label}`} className="text-slate-400 hover:text-slate-700">
                    <IconX className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={clearAll} className="ml-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Clear all
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Project</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Client</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">PM</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Stage</th>
                  <SortableHeader label="Health" sortKey="health" sort={sort} setSort={setSort} />
                  <SortableHeader label="Progress" sortKey="progress" sort={sort} setSort={setSort} />
                  <SortableHeader label="Contract Value" sortKey="contractValue" sort={sort} setSort={setSort} />
                  <SortableHeader label="SPI" sortKey="spi" sort={sort} setSort={setSort} />
                  <SortableHeader label="CPI" sortKey="cpi" sort={sort} setSort={setSort} />
                  <SortableHeader label="Risks" sortKey="risks" sort={sort} setSort={setSort} />
                  <SortableHeader label="Next Milestone" sortKey="nextMilestone" sort={sort} setSort={setSort} />
                  <SortableHeader label="Last Updated" sortKey="updatedAt" sort={sort} setSort={setSort} />
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <ProjectRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && <p className="text-sm text-slate-400 p-4">No projects match the current filters.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  if (!onClick) return <div className="h-full">{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "text-left rounded-xl transition-shadow w-full h-full",
        active ? "ring-2 ring-indigo-400 ring-offset-1 rounded-xl" : "hover:shadow-sm"
      )}
    >
      {children}
    </button>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  setSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir } | null;
  setSort: (s: { key: SortKey; dir: SortDir } | null) => void;
}) {
  const active = sort?.key === sortKey;
  function onClick() {
    if (!active) setSort({ key: sortKey, dir: "desc" });
    else if (sort!.dir === "desc") setSort({ key: sortKey, dir: "asc" });
    else setSort(null);
  }
  return (
    <th className="px-3 py-2.5 font-medium whitespace-nowrap">
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-slate-700">
        {label}
        <IconChevronDown className={clsx("h-3 w-3 transition-transform", active && sort!.dir === "asc" && "rotate-180", !active && "opacity-30")} />
      </button>
    </th>
  );
}

function ProjectRow({ row: r }: { row: PortfolioRow }) {
  const ragColor = RAG_COLORS[r.rag];
  const spiColor = r.latestSpi != null ? INDEX_BAND_COLORS[indexBand(r.latestSpi)] : null;
  const cpiColor = r.latestCpi != null ? INDEX_BAND_COLORS[indexBand(r.latestCpi)] : null;

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <Link href={`/projects/${r.id}/dashboard`} prefetch={false} className="font-medium text-slate-800 hover:text-blue-600 hover:underline">
          {r.name}
        </Link>
        {r.status === "ARCHIVED" && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Archived</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.client || "—"}</td>
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {r.pmName ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white shrink-0"
              style={{ backgroundColor: avatarColorFromString(r.pmName) }}
            >
              {initials(r.pmName)}
            </span>
            {r.pmName}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.stage}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: ragColor.bg, color: ragColor.text }}
        >
          {r.rag === "GREEN" ? "Healthy" : r.rag === "AMBER" ? "At Risk" : "Critical"}
        </span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-2 w-28">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-slate-800" style={{ width: `${r.progress * 100}%` }} />
          </div>
          <span className="text-xs text-slate-500 shrink-0">{Math.round(r.progress * 100)}%</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatMoney(r.contractValue)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: spiColor?.text }}>
        {r.latestSpi != null ? r.latestSpi.toFixed(2) : "—"}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: cpiColor?.text }}>
        {r.latestCpi != null ? r.latestCpi.toFixed(2) : "—"}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={clsx(
            "inline-flex items-center justify-center rounded-full min-w-[1.5rem] px-1.5 py-0.5 text-xs font-medium",
            r.openRisks > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {r.openRisks}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap" title={r.nextMilestone?.name}>
        {r.nextMilestone ? `${formatShortDate(r.nextMilestone.date)} · ${r.nextMilestone.name}` : "—"}
      </td>
      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap" title={formatDateTime(r.updatedAt)}>
        {formatShortDate(r.updatedAt)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/projects/${r.id}/dashboard`}
            prefetch={false}
            className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            View Project
          </Link>
          <RowActionsMenu projectId={r.id} />
        </div>
      </td>
    </tr>
  );
}

function RowActionsMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const links = [
    { label: "View Dashboard", href: `/projects/${projectId}/dashboard` },
    { label: "View Risks", href: `/projects/${projectId}/risks` },
    { label: "View Dependencies", href: `/projects/${projectId}/dependencies` },
    { label: "View Budget", href: `/projects/${projectId}/budget` },
    { label: "View Delivery", href: `/projects/${projectId}/delivery` },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="More actions"
      >
        <IconDotsVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-10">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderOption?: (v: string) => string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filter by ${label}`}
        className="appearance-none rounded-md border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
      >
        <option value="ALL">{label}: All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
    </div>
  );
}
