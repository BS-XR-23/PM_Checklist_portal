"use client";

import { useTransition } from "react";
import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { STATUS_COLORS } from "@/lib/colors";
import { addTimelineRow, updateTimelineRow, deleteTimelineRow } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type TimelineRowData = {
  id: string;
  phase: string;
  start: string;
  end: string;
  status: string;
};

const TIMELINE_STATUSES = ["Not Started", "In Progress", "Completed"] as const;

export function TimelineTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: TimelineRowData[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Phase</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">End</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.phase} onSave={(v) => updateTimelineRow(r.id, projectId, { phase: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.start} onSave={(v) => updateTimelineRow(r.id, projectId, { start: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.end} onSave={(v) => updateTimelineRow(r.id, projectId, { end: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineSelect
                  value={r.status}
                  options={TIMELINE_STATUSES}
                  onSave={(v) => updateTimelineRow(r.id, projectId, { status: v })}
                  style={{ backgroundColor: STATUS_COLORS[r.status === "Completed" ? "COMPLETED" : r.status === "In Progress" ? "IN_PROGRESS" : "NOT_STARTED"].bg }}
                />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteTimelineRow(r.id, projectId))}
                  disabled={pending}
                  className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => startTransition(() => addTimelineRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add phase
      </button>
    </div>
  );
}
