"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatShortDate, formatDate } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { RISK_SEVERITY_COLORS, PRESALES_STAGE_COLORS, FORECAST_CATEGORY_COLORS } from "@/lib/colors";
import { reminderBand } from "@/lib/calculations";
import { STAGE_ORDER, STAGE_INFO, PRESALES_STALE_DAYS, formatByCurrency } from "@/lib/presales-stage";
import { InlineSelect } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { updatePresalesProject } from "./actions";
import { DeleteButton, RestoreButton, PermanentDeleteButton } from "./delete-buttons";
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
  const [filter, setFilter] = useState<"OPEN" | "WON" | "LOST" | "ALL" | "DELETED">("OPEN");

  const visible = cards
    .filter((c) => (filter === "DELETED" ? c.deletedAt !== null : c.deletedAt === null))
    .filter((c) => filter === "ALL" || filter === "DELETED" || c.outcome === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterPill label="Open" active={filter === "OPEN"} onClick={() => setFilter("OPEN")} />
        <FilterPill label="Won" active={filter === "WON"} onClick={() => setFilter("WON")} />
        <FilterPill label="Lost" active={filter === "LOST"} onClick={() => setFilter("LOST")} />
        <FilterPill label="All" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        {isAdmin && <FilterPill label="Deleted" active={filter === "DELETED"} onClick={() => setFilter("DELETED")} />}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No opportunities match this filter.</p>
      ) : filter === "OPEN" ? (
        <PresalesBoard cards={visible} canWrite={canWrite} people={people} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <PresalesCard key={p.id} p={p} canWrite={canWrite} isAdmin={isAdmin} people={people} />
          ))}
        </div>
      )}
    </div>
  );
}

// Columns = stage, grouped client-side from the already-fetched OPEN cards
// — no existing side-by-side-columns UI pattern anywhere else in this app,
// so this is deliberately new layout rather than an adaptation.
function PresalesBoard({
  cards,
  canWrite,
  people,
}: {
  cards: PresalesCardData[];
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const byStage = new Map<PresalesStage, PresalesCardData[]>(STAGE_ORDER.map((s) => [s, []]));
  for (const c of cards) byStage.get(c.stage)?.push(c);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {STAGE_ORDER.map((stage) => {
        const items = byStage.get(stage) ?? [];
        const color = PRESALES_STAGE_COLORS[stage];
        return (
          <div key={stage} className="flex-shrink-0 w-80">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: color.text }}>
                {color.label}
                <InfoTooltip text={STAGE_INFO[stage]} />
              </span>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-3 rounded-lg bg-slate-50 p-2 min-h-[80px]">
              {items.map((p) => (
                <PresalesCard key={p.id} p={p} canWrite={canWrite} isAdmin={false} people={people} compact />
              ))}
              {items.length === 0 && <p className="text-xs text-slate-400 px-2 py-3">No opportunities</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PresalesCard({
  p,
  canWrite,
  isAdmin,
  people,
  compact,
}: {
  p: PresalesCardData;
  canWrite: boolean;
  isAdmin: boolean;
  people: { id: string; name: string }[];
  compact?: boolean;
}) {
  const isDeleted = p.deletedAt !== null;
  const badge = OUTCOME_BADGE[p.outcome];
  const closeBand = p.outcome === "OPEN" ? reminderBand(p.expectedCloseDate, false) : null;
  const isStale = p.outcome === "OPEN" && !p.onHold && (Date.now() - p.updatedAt.getTime()) / 86400000 >= PRESALES_STALE_DAYS;
  const nextAction = p.actionItems[0] ?? null;

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900 truncate" title={p.name}>{p.name}</h3>
          {p.client && <p className="text-sm text-slate-500 truncate">{p.client}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isDeleted && (
            <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">Deleted</span>
          )}
          {p.outcome === "OPEN" && p.onHold && (
            <span
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap"
              title={p.holdReason ?? undefined}
            >
              On Hold
            </span>
          )}
          {isStale && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: RISK_SEVERITY_COLORS.high.bg, color: RISK_SEVERITY_COLORS.high.text }}
              title={`No activity in ${PRESALES_STALE_DAYS}+ days`}
            >
              Stale
            </span>
          )}
          {p.outcome === "OPEN" && p.pocDone && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
              POC ✓
            </span>
          )}
          {p.outcome === "OPEN" && p.forecastCategory && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: FORECAST_CATEGORY_COLORS[p.forecastCategory].bg, color: FORECAST_CATEGORY_COLORS[p.forecastCategory].text }}
            >
              {FORECAST_CATEGORY_COLORS[p.forecastCategory].label}
            </span>
          )}
          {closeBand && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
              style={{
                backgroundColor: (closeBand === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium).bg,
                color: (closeBand === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium).text,
              }}
              title={`Expected close ${formatDate(p.expectedCloseDate)}`}
            >
              ⚠ {closeBand === "OVERDUE" ? "Overdue" : "Due Soon"}
            </span>
          )}
          {!compact && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {p.outcome === "OPEN" ? "Open" : p.outcome === "WON" ? "Won" : "Lost"}
            </span>
          )}
        </div>
      </div>

      {p.outcome === "OPEN" && !isDeleted && (
        <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          {canWrite ? (
            <InlineSelect
              value={p.stage}
              options={STAGE_ORDER}
              renderOption={(s) => PRESALES_STAGE_COLORS[s as PresalesStage].label}
              className="rounded-full border-0 px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: PRESALES_STAGE_COLORS[p.stage].bg, color: PRESALES_STAGE_COLORS[p.stage].text }}
              onSave={(v) => updatePresalesProject(p.id, { stage: v as PresalesStage })}
            />
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: PRESALES_STAGE_COLORS[p.stage].bg, color: PRESALES_STAGE_COLORS[p.stage].text }}
            >
              {PRESALES_STAGE_COLORS[p.stage].label}
            </span>
          )}
          {canWrite ? (
            <PersonPicker
              personId={p.dealOwnerPersonId}
              legacyText={null}
              people={people}
              onSave={(id) => updatePresalesProject(p.id, { dealOwnerPersonId: id })}
            />
          ) : (
            <span className="text-xs text-slate-500">{p.dealOwnerPerson?.name ?? "No owner"}</span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <StatChip label="Est. Value" value={p.estimatedValue ? formatByCurrency(p.estimatedValue, p.estimatedValueCurrency) : "—"} />
        <StatChip
          label="Expected Close"
          value={p.expectedCloseDate ? formatShortDate(p.expectedCloseDate) : "—"}
          title={p.expectedCloseDate ? formatDate(p.expectedCloseDate) : undefined}
        />
      </div>

      {p.outcome === "OPEN" && (
        <p className="mt-2 text-xs text-slate-400 truncate" title={nextAction?.description}>
          Next: {nextAction ? nextAction.description : "No open action items"}
          {nextAction?.dueDate && ` · ${formatShortDate(nextAction.dueDate)}`}
        </p>
      )}

      {p.outcome === "LOST" && p.lostReason && <p className="mt-2 text-xs text-slate-400 truncate" title={p.lostReason}>Reason: {p.lostReason}</p>}
      {p.outcome === "WON" && p.wonProject && <p className="mt-2 text-xs text-emerald-600">→ {p.wonProject.name}</p>}

      {canWrite && (
        <div className="mt-3 flex items-center justify-end gap-3">
          {isDeleted ? (
            <>
              <RestoreButton id={p.id} />
              {isAdmin && <PermanentDeleteButton id={p.id} />}
            </>
          ) : (
            <DeleteButton id={p.id} />
          )}
        </div>
      )}
    </>
  );

  if (isDeleted) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 opacity-60">
        {cardBody}
      </div>
    );
  }

  return (
    <Link
      href={`/presales/${p.id}`}
      prefetch={false}
      className={clsx(
        "block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all",
        p.outcome !== "OPEN" && "opacity-70"
      )}
    >
      {cardBody}
    </Link>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
    </button>
  );
}

function StatChip({ label, value, title, sub }: { label: string; value: string; title?: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5" title={title}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium truncate">{value}</p>
      {sub}
    </div>
  );
}
