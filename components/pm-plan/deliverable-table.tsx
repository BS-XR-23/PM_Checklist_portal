"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { addDeliverableRow, updateDeliverableRow, deleteDeliverableRow } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type DeliverableRowData = {
  id: string;
  deliverable: string;
  acceptanceEvidence: string;
  owner: string;
  target: string;
};

export function DeliverableTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: DeliverableRowData[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Deliverable</th>
            <th className="px-3 py-2 font-medium">Acceptance Evidence</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.deliverable} onSave={(v) => updateDeliverableRow(r.id, projectId, { deliverable: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.acceptanceEvidence} onSave={(v) => updateDeliverableRow(r.id, projectId, { acceptanceEvidence: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.owner} onSave={(v) => updateDeliverableRow(r.id, projectId, { owner: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.target} onSave={(v) => updateDeliverableRow(r.id, projectId, { target: v })} />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteDeliverableRow(r.id, projectId))}
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
        onClick={() => startTransition(() => addDeliverableRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add deliverable
      </button>
    </div>
  );
}
