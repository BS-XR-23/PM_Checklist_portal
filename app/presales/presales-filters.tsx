"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatShortDate, formatDate } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { DeleteButton, RestoreButton, PermanentDeleteButton } from "./delete-buttons";
import type { PresalesOutcome } from "@prisma/client";

export type PresalesCardData = {
  id: string;
  name: string;
  client: string | null;
  estimatedValue: number | null;
  expectedCloseDate: Date | null;
  outcome: PresalesOutcome;
  lostReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  wonProject: { id: string; name: string } | null;
};

const OUTCOME_BADGE: Record<PresalesOutcome, { bg: string; text: string; label: string }> = {
  OPEN: RAG_COLORS.AMBER,
  WON: RAG_COLORS.GREEN,
  LOST: RAG_COLORS.RED,
};

export function PresalesFilters({ cards, canWrite, isAdmin }: { cards: PresalesCardData[]; canWrite: boolean; isAdmin: boolean }) {
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
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => {
            const isDeleted = p.deletedAt !== null;
            const badge = OUTCOME_BADGE[p.outcome];

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
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: badge.bg, color: badge.text }}
                    >
                      {p.outcome === "OPEN" ? "Open" : p.outcome === "WON" ? "Won" : "Lost"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <StatChip label="Est. Value" value={p.estimatedValue ? formatMoney(p.estimatedValue) : "—"} />
                  <StatChip
                    label="Expected Close"
                    value={p.expectedCloseDate ? formatShortDate(p.expectedCloseDate) : "—"}
                    title={p.expectedCloseDate ? formatDate(p.expectedCloseDate) : undefined}
                  />
                </div>

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
                <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4 opacity-60">
                  {cardBody}
                </div>
              );
            }

            return (
              <Link
                key={p.id}
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
          })}
        </div>
      )}
    </div>
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

function StatChip({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5" title={title}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium truncate">{value}</p>
    </div>
  );
}
