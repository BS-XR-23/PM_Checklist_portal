"use client";

import { InlineNumber } from "@/components/ui/inline-edit";
import { updateProjectFinancials } from "../project-actions";

export function ContractInputsForm({
  projectId,
  contractValue,
  plannedStoryPoints,
  plannedManDays,
}: {
  projectId: string;
  contractValue: number;
  plannedStoryPoints: number;
  plannedManDays: number;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Total Contract Value ($)</label>
        <InlineNumber
          value={contractValue}
          step={0.01}
          onSave={(v) => updateProjectFinancials(projectId, { contractValue: v ?? 0 })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Total Planned Story Points</label>
        <InlineNumber
          value={plannedStoryPoints}
          step={1}
          onSave={(v) => updateProjectFinancials(projectId, { plannedStoryPoints: v ?? 0 })}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Total Planned Man-Days <span className="font-normal text-slate-400">(reference rate input only — not used in PV/EV)</span>
        </label>
        <InlineNumber
          value={plannedManDays}
          step={0.5}
          onSave={(v) => updateProjectFinancials(projectId, { plannedManDays: v ?? 0 })}
        />
      </div>
    </div>
  );
}
