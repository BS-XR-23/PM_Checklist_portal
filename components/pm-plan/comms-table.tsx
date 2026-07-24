"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { addCommsRow, updateCommsRow, deleteCommsRow } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type CommsRowData = { id: string; audience: string; frequency: string; channel: string; content: string };

export function CommsTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: CommsRowData[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Audience</th>
            <th className="px-3 py-2 font-medium">Frequency</th>
            <th className="px-3 py-2 font-medium">Channel</th>
            <th className="px-3 py-2 font-medium">Content</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.audience} onSave={(v) => updateCommsRow(r.id, projectId, { audience: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.frequency} onSave={(v) => updateCommsRow(r.id, projectId, { frequency: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.channel} onSave={(v) => updateCommsRow(r.id, projectId, { channel: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.content} onSave={(v) => updateCommsRow(r.id, projectId, { content: v })} />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteCommsRow(r.id, projectId))}
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
        onClick={() => startTransition(() => addCommsRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add row
      </button>
    </div>
  );
}
