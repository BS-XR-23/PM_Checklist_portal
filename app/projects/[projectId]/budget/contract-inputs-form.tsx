"use client";

import { InlineNumber } from "@/components/ui/inline-edit";
import { updateProjectFinancials } from "../project-actions";

export function ContractInputsForm({
  projectId,
  contractValue,
  baselinePoints,
  plannedManDays,
}: {
  projectId: string;
  contractValue: number;
  baselinePoints: number;
  plannedManDays: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Total Contract Value ($)</label>
        <InlineNumber
          value={contractValue}
          step={0.01}
          onSave={(v) => updateProjectFinancials(projectId, { contractValue: v ?? 0 })}
        />
      </div>
      {/* Derived, not typed in — the sum of every WBS task's story points
          (Delivery → Tasks). The old hand-entered field sat at 0 on every
          project, which zeroed PV/EV. */}
      <div>
        <p className="block text-xs font-medium text-slate-600 mb-1">Baseline Story Points</p>
        <p className="text-sm text-slate-800 py-1">{baselinePoints}</p>
        <p className="text-[11px] text-slate-400">Sum of WBS task points</p>
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
