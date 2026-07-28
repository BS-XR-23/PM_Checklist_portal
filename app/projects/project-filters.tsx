"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatMoney, formatDate, formatPct } from "@/lib/format";
import { PM_STAGES } from "@/lib/seed-data";
import { ArchiveButton } from "./archive-button";
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
  pmStage: string; // one of PM_STAGES, or "Complete"
  endDate: Date | null; // derived — latest Forecast Date across the checklist
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
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [stageFilter, setStageFilter] = useState<string>("ALL");

  const visible = cards
    .filter((c) => statusFilter === "ALL" || c.status === statusFilter)
    .filter((c) => stageFilter === "ALL" || c.pmStage === stageFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="Active" active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} />
          <FilterPill label="Archived" active={statusFilter === "ARCHIVED"} onClick={() => setStatusFilter("ARCHIVED")} />
          <FilterPill label="All" active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All Stages" active={stageFilter === "ALL"} onClick={() => setStageFilter("ALL")} />
          {STAGE_OPTIONS.map((s) => (
            <FilterPill key={s} label={s} active={stageFilter === s} onClick={() => setStageFilter(s)} />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No projects match this filter.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => {
            const color = avatarColor(p.id);
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{p.name}</h3>
                      {p.client && <p className="text-sm text-slate-500 truncate">{p.client}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.status === "ARCHIVED" && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
                        Archived
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-semibold">
                      {formatPct(p.pct)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-800" style={{ width: `${p.pct * 100}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <StatChip label="Items" value={`${p.completed}/${p.total}`} />
                  <StatChip label="Value" value={p.contractValue > 0 ? formatMoney(p.contractValue) : "—"} />
                  <StatChip label="Started" value={formatDate(p.createdAt)} />
                  <StatChip label="Ends" value={p.endDate ? formatDate(p.endDate) : "—"} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Stage: {p.pmStage}</span>
                  {isAdmin && <ArchiveButton projectId={p.id} status={p.status} />}
                </div>
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 font-medium truncate">{value}</p>
    </div>
  );
}
