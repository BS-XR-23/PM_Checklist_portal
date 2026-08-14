"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { DeliveryTasksTable, type WbsTaskData, type RosterPerson } from "./delivery-tasks-table";
import { UploadWbsTasksForm } from "./upload-wbs-tasks-form";

export type WbsWeekData = { id: string; weekEnding: Date; tasks: WbsTaskData[] };

export function DeliveryWeekRow({
  projectId,
  week,
  roster,
  canWrite,
}: {
  projectId: string;
  week: WbsWeekData;
  roster: RosterPerson[];
  canWrite: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/60"
      >
        <span className="text-sm font-medium text-slate-800">Week ending {formatDate(week.weekEnding)}</span>
        <span className="text-xs text-slate-400">
          {week.tasks.length} task{week.tasks.length === 1 ? "" : "s"} {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3">
          <DeliveryTasksTable projectId={projectId} wbsWeekId={week.id} tasks={week.tasks} roster={roster} canWrite={canWrite} />
          {canWrite && <UploadWbsTasksForm projectId={projectId} wbsWeekId={week.id} />}
        </div>
      )}
    </div>
  );
}
