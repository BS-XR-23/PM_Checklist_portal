"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { WeekEntriesTable, type WeekEntryData, type MasterTaskOption } from "./week-entries-table";
import type { RosterPerson } from "./delivery-tasks-table";

export type WbsWeekData = { id: string; weekEnding: Date; entries: WeekEntryData[] };

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
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/60"
      >
        <span className="text-sm font-medium text-slate-800">Week ending {formatDate(week.weekEnding)}</span>
        <span className="text-xs text-slate-400">
          {week.entries.length} task{week.entries.length === 1 ? "" : "s"} {expanded ? "▾" : "▸"}
        </span>
      </button>
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
