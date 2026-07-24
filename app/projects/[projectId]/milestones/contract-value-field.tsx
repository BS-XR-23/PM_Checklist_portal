"use client";

import { InlineNumber } from "@/components/ui/inline-edit";
import { updateProjectFinancials } from "../project-actions";

export function ContractValueField({ projectId, value }: { projectId: string; value: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Total Contract Value ($)</label>
      <InlineNumber
        value={value}
        step={0.01}
        onSave={(v) => updateProjectFinancials(projectId, { contractValue: v ?? 0 })}
      />
      <p className="mt-1 text-xs text-slate-400">Tranche amounts below recalculate from this value.</p>
    </div>
  );
}
