"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { PresalesStage } from "@prisma/client";
import { formatDate, formatMoney, formatPct, formatShortDate, initials } from "@/lib/format";
import { PRESALES_STAGE_COLORS, FORECAST_CATEGORY_COLORS, avatarColorFromString } from "@/lib/colors";
import { STAGE_ORDER, STAGE_INFO, formatByCurrency } from "@/lib/presales-stage";
import { STAGE_WIN_PROBABILITY, closeCountdownLabel } from "@/lib/presales-pipeline";
import { IconSearch, IconCalendar, IconGrid, IconClipboardList } from "@/components/layout/icons";
import { updatePresalesProject } from "./actions";
import { PresalesFilters, type PresalesCardData } from "./presales-filters";

type View = "board" | "table";
const VIEW_KEY = "presales:view";
const UNASSIGNED = "__unassigned__";

/**
 * Presales landing view: a stage board (default) or the filterable table.
 * The view choice is a per-viewer convenience in localStorage — wrapped in
 * try/catch since storage can be blocked, and the board is the fallback.
 */
export function PresalesPipeline({
  cards,
  byStage,
  canWrite,
  isAdmin,
  people,
}: {
  cards: PresalesCardData[];
  byStage: Record<PresalesStage, { count: number; valueUsd: number }>;
  canWrite: boolean;
  isAdmin: boolean;
  people: { id: string; name: string }[];
}) {
  const [view, setView] = useState<View>("board");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "table") setView(saved);
    } catch {}
  }, []);
  const choose = (v: View) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Opportunities</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Pipeline view">
          <ViewButton active={view === "board"} onClick={() => choose("board")} icon={<IconGrid className="h-3.5 w-3.5" />} label="Board" />
          <ViewButton active={view === "table"} onClick={() => choose("table")} icon={<IconClipboardList className="h-3.5 w-3.5" />} label="Table" />
        </div>
      </div>
      {view === "board" ? (
        <PresalesBoard cards={cards} byStage={byStage} canWrite={canWrite} />
      ) : (
        <PresalesFilters cards={cards} canWrite={canWrite} isAdmin={isAdmin} people={people} />
      )}
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
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PresalesBoard({
  cards,
  byStage,
  canWrite,
}: {
  cards: PresalesCardData[];
  byStage: Record<PresalesStage, { count: number; valueUsd: number }>;
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  // Optimistic stage while a drag-drop save is in flight; the server
  // revalidation then brings the same value back in props.
  const [moved, setMoved] = useState<Record<string, PresalesStage>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PresalesStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = useMemo(() => cards.filter((c) => c.deletedAt === null), [cards]);
  const owners = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of live) if (c.dealOwnerPerson) byId.set(c.dealOwnerPerson.id, c.dealOwnerPerson.name);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [live]);

  const visible = live.filter((c) => {
    const q = search.trim().toLowerCase();
    if (q && !`${c.name} ${c.client ?? ""} ${c.dealOwnerPerson?.name ?? ""}`.toLowerCase().includes(q)) return false;
    if (owner === UNASSIGNED ? c.dealOwnerPersonId !== null : owner && c.dealOwnerPersonId !== owner) return false;
    if (attentionOnly && !c.flags.needsAttention) return false;
    return true;
  });
  const open = visible.filter((c) => c.outcome === "OPEN");
  const closed = visible.filter((c) => c.outcome !== "OPEN");
  const filtering = !!(search || owner || attentionOnly);

  const drop = (stage: PresalesStage) => {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const card = live.find((c) => c.id === id);
    if (!card || (moved[id] ?? card.stage) === stage) return;
    setError(null);
    setMoved((m) => ({ ...m, [id]: stage }));
    startTransition(async () => {
      try {
        await updatePresalesProject(id, { stage });
      } catch (err) {
        setMoved((m) => {
          const rest = { ...m };
          delete rest[id];
          return rest;
        });
        setError(err instanceof Error ? err.message : "Couldn't move that deal.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="relative sm:w-72">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deal, client, or owner…"
            className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-600">
            <option value="">All deal owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            {live.some((c) => c.dealOwnerPersonId === null) && <option value={UNASSIGNED}>No owner</option>}
          </select>
          <button
            type="button"
            onClick={() => setAttentionOnly((v) => !v)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              attentionOnly ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            ⚠ Needs attention
          </button>
          {canWrite && <span className="hidden lg:inline text-xs text-slate-400">Drag a card to another column to change its stage.</span>}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STAGE_ORDER.map((stage) => {
          const color = PRESALES_STAGE_COLORS[stage];
          const stageCards = open.filter((c) => (moved[c.id] ?? c.stage) === stage);
          const totals = filtering || Object.keys(moved).length
            ? { count: stageCards.length, valueUsd: stageCards.reduce((s, c) => s + c.valueUsd, 0) }
            : byStage[stage];
          const isOver = overStage === stage && dragId !== null;
          return (
            <section
              key={stage}
              aria-label={`${color.label} stage`}
              onDragOver={(e) => {
                if (!canWrite || !dragId) return;
                e.preventDefault();
                if (overStage !== stage) setOverStage(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage);
              }}
              className={clsx(
                "flex flex-col rounded-xl border bg-slate-100/70 transition-colors",
                isOver ? "border-slate-400 bg-slate-200/70 ring-2 ring-slate-300" : "border-slate-200"
              )}
            >
              <header className="rounded-t-xl border-t-4 bg-white/70 px-3 pt-2.5 pb-2" style={{ borderTopColor: color.text }} title={STAGE_INFO[stage]}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{color.label}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: color.bg, color: color.text }}>
                    {totals.count}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{formatMoney(totals.valueUsd)}</span> · {formatPct(STAGE_WIN_PROBABILITY[stage])} win
                </p>
              </header>
              <div className="flex-1 space-y-2 p-2 min-h-[120px]">
                {stageCards.map((c) => (
                  <DealCard
                    key={c.id}
                    card={c}
                    stage={moved[c.id] ?? c.stage}
                    draggable={canWrite}
                    dragging={dragId === c.id}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                  />
                ))}
                {stageCards.length === 0 && (
                  <div className="flex h-12 md:h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                    {isOver ? "Drop to move here" : filtering ? "No matching deals" : "No deals in this stage"}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ClosedDeals cards={closed} />
    </div>
  );
}

function DealCard({
  card: c,
  stage,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  card: PresalesCardData;
  stage: PresalesStage;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const f = c.flags;
  const next = c.actionItems[0] ?? null;
  const nextOverdue = next?.dueDate ? next.dueDate.getTime() < Date.now() - 86_400_000 : false;
  const showClient = c.client && c.client.trim().toLowerCase() !== c.name.trim().toLowerCase();

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={clsx(
        "group relative rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md",
        f.needsAttention ? "border-l-[3px] border-l-red-400 border-slate-200" : "border-slate-200 hover:border-slate-300",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        c.onHold && "bg-slate-50"
      )}
    >
      <Link href={`/presales/${c.id}`} prefetch={false} className="block text-sm font-semibold leading-snug text-slate-900 hover:text-blue-700 after:absolute after:inset-0" draggable={false}>
        {c.name}
      </Link>
      {showClient && <p className="mt-0.5 truncate text-xs text-slate-500">{c.client}</p>}

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-base font-bold text-slate-900">{c.estimatedValue ? formatByCurrency(c.estimatedValue, c.estimatedValueCurrency) : "No value"}</span>
        <span className="text-[11px] text-slate-400">· {formatPct(STAGE_WIN_PROBABILITY[stage])} win</span>
      </div>

      {(f.closeOverdue || f.stale || c.onHold || c.forecastCategory || c.pocDone) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {f.closeOverdue && <Badge className="bg-red-50 text-red-700">Past close date</Badge>}
          {f.stale && <Badge className="bg-amber-50 text-amber-800">Idle {f.idleDays}d</Badge>}
          {c.onHold && <Badge className="bg-slate-200 text-slate-700">On hold</Badge>}
          {c.forecastCategory && (
            <Badge style={{ backgroundColor: FORECAST_CATEGORY_COLORS[c.forecastCategory].bg, color: FORECAST_CATEGORY_COLORS[c.forecastCategory].text }}>
              {FORECAST_CATEGORY_COLORS[c.forecastCategory].label}
            </Badge>
          )}
          {c.pocDone && <Badge className="bg-emerald-50 text-emerald-700">POC ✓</Badge>}
        </div>
      )}

      <div className={clsx("mt-2.5 rounded-md px-2 py-1.5 text-xs", next ? "bg-slate-50 text-slate-700" : f.noNextStep ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-400")}>
        {next ? (
          <>
            <span className="text-slate-400">Next: </span>
            <span className="line-clamp-2">{next.description}</span>
            {next.dueDate && (
              <span className={clsx("mt-0.5 block text-[11px]", nextOverdue ? "font-medium text-red-600" : "text-slate-400")}>
                due {formatShortDate(next.dueDate)}
                {c.openActionCount > 1 && ` · +${c.openActionCount - 1} more`}
              </span>
            )}
          </>
        ) : (
          "No next step planned"
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        {c.dealOwnerPerson ? (
          <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: avatarColorFromString(c.dealOwnerPerson.name) }}
            >
              {initials(c.dealOwnerPerson.name)}
            </span>
            <span className="truncate">{c.dealOwnerPerson.name}</span>
          </span>
        ) : (
          <span className="text-slate-400">No owner</span>
        )}
        {c.expectedCloseDate && (
          <span
            className={clsx("inline-flex shrink-0 items-center gap-1", f.closeOverdue ? "font-medium text-red-600" : "text-slate-500")}
            title={`Expected close ${formatDate(c.expectedCloseDate)} — ${closeCountdownLabel(f.closeInDays)}`}
          >
            <IconCalendar className="h-3 w-3" />
            {formatShortDate(c.expectedCloseDate)}
          </span>
        )}
      </div>
    </article>
  );
}

function Badge({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", className)} style={style}>
      {children}
    </span>
  );
}

function ClosedDeals({ cards }: { cards: PresalesCardData[] }) {
  const won = cards.filter((c) => c.outcome === "WON");
  const lost = cards.filter((c) => c.outcome === "LOST");
  if (cards.length === 0) {
    return <p className="text-xs text-slate-400">No closed deals yet — won and lost opportunities collect here as history.</p>;
  }
  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
        <span>
          Closed deals <span className="font-normal text-slate-400">· {won.length} won · {lost.length} lost</span>
        </span>
        <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {[...won, ...lost].map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                c.outcome === "WON" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}
            >
              {c.outcome === "WON" ? "Won" : "Lost"}
            </span>
            <Link href={`/presales/${c.id}`} prefetch={false} className="font-medium text-slate-800 hover:text-blue-700">
              {c.name}
            </Link>
            <span className="text-slate-500">{c.estimatedValue ? formatByCurrency(c.estimatedValue, c.estimatedValueCurrency) : "—"}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {c.outcome === "WON" && c.wonProject ? (
                <Link href={`/projects/${c.wonProject.id}/dashboard`} className="text-emerald-700 hover:underline">
                  → {c.wonProject.name}
                </Link>
              ) : (
                c.lostReason
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
