"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { addStakeholderRow, updateStakeholderRow, deleteStakeholderRow } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export type StakeholderRowData = { id: string; stakeholder: string; role: string; responsibility: string; accessRequired: string };

export function StakeholdersTable({ pmPlanId, projectId, rows }: { pmPlanId: string; projectId: string; rows: StakeholderRowData[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Stakeholder</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Responsibility</th>
            <th className="px-3 py-2 font-medium">Access Required</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.stakeholder} onSave={(v) => updateStakeholderRow(r.id, projectId, { stakeholder: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.role} onSave={(v) => updateStakeholderRow(r.id, projectId, { role: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.responsibility} onSave={(v) => updateStakeholderRow(r.id, projectId, { responsibility: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.accessRequired} onSave={(v) => updateStakeholderRow(r.id, projectId, { accessRequired: v })} />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteStakeholderRow(r.id, projectId))}
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
        onClick={() => startTransition(() => addStakeholderRow(pmPlanId, projectId))}
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add stakeholder
      </button>
    </div>
  );
}
