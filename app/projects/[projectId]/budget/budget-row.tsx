"use client";

import { useTransition } from "react";
import { InlineDate, InlineNumber, InlinePercent, InlineText } from "@/components/ui/inline-edit";
import { formatMoney, formatDate, formatPct, toDateInputValue } from "@/lib/format";
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
  const favorable = value >= 1;
  const color = favorable ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: favorable ? "#E6F4EC" : "#FBE9E9", color }}
    >
      {value.toFixed(2)}
    </span>
  );
}

export function BudgetRow({
  projectId,
  entry,
  evm,
  canWrite,
  costHidden,
}: {
  projectId: string;
  entry: BudgetEntryData;
  evm: EvmPoint;
  canWrite: boolean;
  costHidden: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!canWrite) {
    return (
      <tr className="group border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(entry.weekEnding)}</td>
        <td className="px-4 py-2.5 text-slate-600">{formatPct(entry.pctPlannedComplete)}</td>
        <td className="px-4 py-2.5 text-slate-600">{formatPct(entry.pctActualComplete)}</td>
        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
        {!costHidden && <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(entry.actualCost)}</td>}
        {!costHidden && <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.cv)}</td>}
        {!costHidden && (
          <td className="px-4 py-2.5 whitespace-nowrap">
            <IndexValue value={evm.spi} />
          </td>
        )}
        {!costHidden && (
          <td className="px-4 py-2.5 whitespace-nowrap">
            <IndexValue value={evm.cpi} />
          </td>
        )}
        <td className="px-4 py-2.5 text-slate-600">{entry.notes || "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="group border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
      <td className="px-4 py-2.5">
        <InlineDate
          value={toDateInputValue(entry.weekEnding)}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { weekEnding: v ?? undefined })}
        />
      </td>
      <td className="px-4 py-2.5">
        <InlinePercent
          value={entry.pctPlannedComplete}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { pctPlannedComplete: v })}
        />
      </td>
      <td className="px-4 py-2.5">
        <InlinePercent
          value={entry.pctActualComplete}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { pctActualComplete: v })}
        />
      </td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
      <td className="px-4 py-2.5">
        <InlineNumber
          value={entry.actualCost}
          step={0.01}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { actualCost: v ?? 0 })}
        />
      </td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.cv)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <IndexValue value={evm.spi} />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <IndexValue value={evm.cpi} />
      </td>
      <td className="px-4 py-2.5">
        <InlineText
          value={entry.notes ?? ""}
          onSave={(v) => updateBudgetEntry(entry.id, projectId, { notes: v })}
        />
      </td>
      <td className="px-4 py-2.5">
        <button
          onClick={() => startTransition(() => deleteBudgetEntry(entry.id, projectId))}
          disabled={pending}
          title="Delete entry"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
