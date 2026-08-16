"use client";

import { useState, useTransition } from "react";
import { formatDate, toDateInputValue } from "@/lib/format";
import { updateWbsWeek } from "./delivery-actions";
import { WeekEntriesTable, type WeekEntryData, type MasterTaskOption } from "./week-entries-table";
import type { RosterPerson } from "./delivery-tasks-table";

export type WbsWeekData = { id: string; weekEnding: Date; entries: WeekEntryData[] };

// Unlike most InlineDate usages elsewhere (a plannedDate/actualDate can
// always be cleared to null with no validation), a week's date is required
// and can collide with another week's — both need a visible error, not a
// swallowed rejected promise, so this can't just reuse the bare InlineDate.
function WeekDateEditor({ weekId, projectId, value }: { weekId: string; projectId: string; value: Date }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        defaultValue={toDateInputValue(value) ?? ""}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          const next = e.target.value;
          if (!next) return;
          startTransition(async () => {
            try {
              await updateWbsWeek(weekId, projectId, next);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to update the week's date.");
            }
          });
        }}
        className="rounded border border-slate-200 px-1.5 py-1 text-sm hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function DeliveryWeekRow({
  projectId,
  week,
  masterTasks,
  roster,
  canWrite,
}: {
  projectId: string;
  week: WbsWeekData;
  masterTasks: MasterTaskOption[];
  roster: RosterPerson[];
  canWrite: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const trackedTaskIds = new Set(week.entries.map((e) => e.wbsTaskId));
  const availableTasks = masterTasks.filter((t) => !trackedTaskIds.has(t.id));

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">Week ending</span>
          {canWrite ? (
            <div onClick={(e) => e.stopPropagation()}>
              <WeekDateEditor weekId={week.id} projectId={projectId} value={week.weekEnding} />
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-800">{formatDate(week.weekEnding)}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {week.entries.length} task{week.entries.length === 1 ? "" : "s"} {expanded ? "▾" : "▸"}
        </span>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3">
          <WeekEntriesTable
            projectId={projectId}
            wbsWeekId={week.id}
            entries={week.entries}
            availableTasks={availableTasks}
            roster={roster}
            canWrite={canWrite}
          />
        </div>
      )}
    </div>
  );
}
