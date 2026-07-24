"use client";

import { useTransition } from "react";
import { InlineDate, InlineNumber, InlinePercent, InlineText } from "@/components/ui/inline-edit";
import { formatMoney, toDateInputValue } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import type { EvmPoint } from "@/lib/calculations";
import { updateBudgetEntry, deleteBudgetEntry } from "./budget-actions";

export type BudgetEntryData = {
  id: string;
  weekEnding: Date;
  pctPlannedComplete: number;
  pctActualComplete: number;
  actualCost: number;
  notes: string | null;
};

function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const color = value >= 1 ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR;
  return (
    <span className="font-medium" style={{ color }}>
      {value.toFixed(2)}
    </span>
  );
}

export function BudgetRow({ projectId, entry, evm }: { projectId: string; entry: BudgetEntryData; evm: EvmPoint }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-1.5">
        <InlineDate
          value={toDateInputValue(entry.weekEnding)}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { weekEnding: v ?? undefined })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlinePercent
          value={entry.pctPlannedComplete}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { pctPlannedComplete: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlinePercent
          value={entry.pctActualComplete}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { pctActualComplete: v })}
        />
      </td>
      <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
      <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
      <td className="px-3 py-1.5">
        <InlineNumber
          value={entry.actualCost}
          step={0.01}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { actualCost: v ?? 0 })}
        />
      </td>
      <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.cv)}</td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <IndexValue value={evm.spi} />
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <IndexValue value={evm.cpi} />
      </td>
      <td className="px-3 py-1.5">
        <InlineText
          value={entry.notes ?? ""}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { notes: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <button
          onClick={() => startTransition(() => deleteBudgetEntry(entry.id, projectId))}
          disabled={pending}
          title="Delete entry"
          className="text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
