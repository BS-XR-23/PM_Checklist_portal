"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { addRaciRow, updateRaciRow, deleteRaciRow } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type RaciRowData = { id: string; activity: string; pm: string; tl: string; ba: string; leadEng: string; creativeLead: string };

export function RaciTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: RaciRowData[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium min-w-[220px]">Activity</th>
            <th className="px-3 py-2 font-medium w-16">PM</th>
            <th className="px-3 py-2 font-medium w-16">TL</th>
            <th className="px-3 py-2 font-medium w-16">BA</th>
            <th className="px-3 py-2 font-medium w-20">Lead Eng.</th>
            <th className="px-3 py-2 font-medium w-24">Creative Lead</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.activity} onSave={(v) => updateRaciRow(r.id, projectId, { activity: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.pm} onSave={(v) => updateRaciRow(r.id, projectId, { pm: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.tl} onSave={(v) => updateRaciRow(r.id, projectId, { tl: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.ba} onSave={(v) => updateRaciRow(r.id, projectId, { ba: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.leadEng} onSave={(v) => updateRaciRow(r.id, projectId, { leadEng: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.creativeLead} onSave={(v) => updateRaciRow(r.id, projectId, { creativeLead: v })} />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteRaciRow(r.id, projectId))}
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
        onClick={() => startTransition(() => addRaciRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add activity
      </button>
    </div>
  );
}
