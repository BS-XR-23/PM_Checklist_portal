"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatDate, formatShortDate, formatPct } from "@/lib/format";
import { PM_STAGES } from "@/lib/seed-data";
import { RAG_COLORS, type Rag } from "@/lib/rag";
import { ArchiveButton } from "./archive-button";
import { DeleteButton, RestoreButton, PermanentDeleteButton } from "./delete-button";
import type { ProjectStatus } from "@prisma/client";

export type ProjectCardData = {
  id: string;
  name: string;
  client: string | null;
  contractValue: number;
  createdAt: Date;
  total: number;
  completed: number;
  pct: number;
  status: ProjectStatus;
  deletedAt: Date | null;
  pmStage: string; // one of PM_STAGES, or "Complete"
  endDate: Date | null; // derived — latest Forecast Date across the checklist
  rag: Rag; // same SPI/CPI/open-high-risk definition as the Portfolio rollup
  overdueCount: number; // items past their Planned Date, empty for viewers who can't see Reminders
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

const STAGE_OPTIONS = [...PM_STAGES, "Complete"];

export function ProjectFilters({ cards, isAdmin }: { cards: ProjectCardData[]; isAdmin: boolean }) {
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | "ALL" | "DELETED">("ACTIVE");
  const [stageFilter, setStageFilter] = useState<string>("ALL");

  const visible = cards
    .filter((c) => (statusFilter === "DELETED" ? c.deletedAt !== null : c.deletedAt === null))
    .filter((c) => statusFilter === "ALL" || statusFilter === "DELETED" || c.status === statusFilter)
    .filter((c) => stageFilter === "ALL" || c.pmStage === stageFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="Active" active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} />
          <FilterPill label="Archived" active={statusFilter === "ARCHIVED"} onClick={() => setStatusFilter("ARCHIVED")} />
          <FilterPill label="All" active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
          {isAdmin && <FilterPill label="Deleted" active={statusFilter === "DELETED"} onClick={() => setStatusFilter("DELETED")} />}
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
        >
          <option value="ALL">All Stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No projects match this filter.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => {
            const color = avatarColor(p.id);
            const isDeleted = p.deletedAt !== null;

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
                      <h3 className="font-medium text-slate-900 truncate" title={p.name}>{p.name}</h3>
                      {p.client && <p className="text-sm text-slate-500 truncate">{p.client}</p>}
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
                      <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">
                        Deleted
                      </span>
                    ) : (
                      p.status === "ARCHIVED" && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
                          Archived
                        </span>
                      )
                    )}
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: RAG_COLORS[p.rag].bg, color: RAG_COLORS[p.rag].text }}
                      title={`RAG: ${RAG_COLORS[p.rag].label}`}
                    >
                      {formatPct(p.pct)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full" style={{ width: `${p.pct * 100}%`, backgroundColor: RAG_COLORS[p.rag].text }} />
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <StatChip label="Items" value={`${p.completed}/${p.total}`} />
                  <StatChip label="Value" value={p.contractValue > 0 ? formatMoney(p.contractValue) : "—"} />
                  <StatChip label="Started" value={formatShortDate(p.createdAt)} title={formatDate(p.createdAt)} />
                  <StatChip label="Ends" value={p.endDate ? formatShortDate(p.endDate) : "—"} title={p.endDate ? formatDate(p.endDate) : undefined} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Stage: {p.pmStage}</span>
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      {isDeleted ? (
                        <>
                          <RestoreButton projectId={p.id} />
                          <PermanentDeleteButton projectId={p.id} />
                        </>
                      ) : (
                        <>
                          <ArchiveButton projectId={p.id} status={p.status} />
                          <DeleteButton projectId={p.id} />
                        </>
                      )}
                    </div>
                  )}
                </div>
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
                href={`/projects/${p.id}/dashboard`}
                prefetch={false}
                className={clsx(
                  "block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all",
                  p.status === "ARCHIVED" && "opacity-60"
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
