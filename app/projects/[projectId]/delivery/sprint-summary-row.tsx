"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { closeSprint } from "./delivery-actions";

function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const favorable = value >= 1;
  const color = favorable ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: favorable ? "#E6F4EC" : "#FBE9E9", color }}
    >
      {value.toFixed(2)}
    </span>
  );
}

export type SprintTaskDrillDown = {
  id: string;
  wbsNumber: string;
  title: string;
  manDays: number;
  storyPoints: number | null;
  pctComplete: number; // this task's latest tracked % as of now (or at close time, if closed)
};

export type SprintSummaryData = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  pv: number;
  ev: number;
  av: number;
  tasks: SprintTaskDrillDown[];
};

/**
 * PV/EV/AV are passed in pre-computed: for an open sprint the caller
 * derives them live (0/100 rule, see sprintEarnedValue), for a closed one
 * they're the permanent frozen* snapshot from the Sprint row — this
 * component never needs to know or care which.
 */
export function SprintSummaryRow({ projectId, sprint, canWrite }: { projectId: string; sprint: SprintSummaryData; canWrite: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cpi = sprint.av ? sprint.ev / sprint.av : null;
  const spi = sprint.pv ? sprint.ev / sprint.pv : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded((x) => !x)}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-800">{sprint.name}</span>
          <span className="text-xs text-slate-400">
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </span>
          {sprint.closedAt ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Closed</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>PV {sprint.pv.toFixed(1)}</span>
          <span>EV {sprint.ev.toFixed(1)}</span>
          <span>AV {sprint.av.toFixed(1)}</span>
          <span className="flex items-center gap-1">
            SPI <IndexValue value={spi} />
          </span>
          <span className="flex items-center gap-1">
            CPI <IndexValue value={cpi} />
          </span>
          <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="font-medium py-1 pr-2 w-20">WBS#</th>
                <th className="font-medium py-1 pr-2">Title</th>
                <th className="font-medium py-1 pr-2 w-20">Story Pts</th>
                <th className="font-medium py-1 pr-2 w-20">Man-days</th>
                <th className="font-medium py-1 pr-2 w-16">Done</th>
              </tr>
            </thead>
            <tbody>
              {sprint.tasks.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">{t.wbsNumber || "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{t.title}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{t.storyPoints ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{t.manDays}</td>
                  <td className="py-1.5 pr-2">
                    {t.pctComplete >= 1 ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              {sprint.tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-slate-400">
                    No tasks committed to this sprint yet — commit some on the Tasks tab.
                  </td>
                </tr>
              )}
              <tr className="border-t border-slate-200 font-medium text-slate-700">
                <td className="py-1.5 pr-2" colSpan={3}>
                  Grand Total (Earned Value)
                </td>
                <td className="py-1.5 pr-2" colSpan={2}>
                  {sprint.ev.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>

          {canWrite && !sprint.closedAt && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    if (!window.confirm(`Close "${sprint.name}"? This freezes its PV/EV/AV permanently and can't be undone.`)) return;
                    try {
                      await closeSprint(sprint.id, projectId);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to close sprint.");
                    }
                  })
                }
                disabled={pending}
                className="rounded-md border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                {pending ? "Closing..." : "Close Sprint"}
              </button>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
