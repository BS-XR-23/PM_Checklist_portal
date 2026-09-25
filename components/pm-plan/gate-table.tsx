"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { addGateRow, updateGateRow, deleteGateRow, seedDefaultGateRows } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type GateRowData = {
  id: string;
  gate: string;
  requiredEvidence: string;
  exitCondition: string;
  status: string;
};

const GATE_STATUSES = ["Not Started", "In Progress", "Approved"] as const;

const STATUS_STYLE: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-500",
  "In Progress": "bg-amber-50 text-amber-700",
  Approved: "bg-emerald-50 text-emerald-700",
};

export function GateTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: GateRowData[] }) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center space-y-2">
        <p className="text-sm text-slate-500">No gates yet.</p>
        <button
          onClick={() => startTransition(() => seedDefaultGateRows(pmPlanId, projectId))}
          disabled={pending}
          className="rounded-md bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
        >
          Load standard PMO gates (G0–G6)
        </button>
        <button
          onClick={() => startTransition(() => addGateRow(pmPlanId, projectId))}
          disabled={pending}
          className="block mx-auto text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          or add one manually
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Gate</th>
            <th className="px-3 py-2 font-medium">Required Evidence</th>
            <th className="px-3 py-2 font-medium">Exit Condition</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.gate} onSave={(v) => updateGateRow(r.id, projectId, { gate: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.requiredEvidence} onSave={(v) => updateGateRow(r.id, projectId, { requiredEvidence: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.exitCondition} onSave={(v) => updateGateRow(r.id, projectId, { exitCondition: v })} />
              </td>
              <td className="px-3 py-1.5">
                <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-500")}>
                  <InlineSelect
                    value={r.status}
                    options={GATE_STATUSES}
                    onSave={(v) => updateGateRow(r.id, projectId, { status: v })}
                    className="bg-transparent border-0 text-xs font-medium focus:ring-0 p-0"
                  />
                </span>
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteGateRow(r.id, projectId))}
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
        onClick={() => startTransition(() => addGateRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add gate
      </button>
    </div>
  );
}
