"use client";

import { useState, useTransition } from "react";
import { InlineDate, InlinePercent, InlineText } from "@/components/ui/inline-edit";
import { formatMoney, formatDate, formatPct, toDateInputValue } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import type { EvmPoint } from "@/lib/calculations";
import { updateBudgetEntry, deleteBudgetEntry, syncActualCompleteFromChecklist } from "./budget-actions";
import { BudgetEntryRoleCosts, type RoleCostData, type RosterPerson } from "./budget-entry-role-costs";

export type BudgetEntryData = {
  id: string;
  weekEnding: Date;
  pctPlannedComplete: number;
  pctActualComplete: number;
  actualCost: number;
  notes: string | null;
  roleCosts: RoleCostData[];
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
  roster,
}: {
  projectId: string;
  entry: BudgetEntryData;
  evm: EvmPoint;
  canWrite: boolean;
  costHidden: boolean;
  roster: RosterPerson[];
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const acCell = (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="whitespace-nowrap text-slate-600 hover:text-slate-900 underline decoration-dotted underline-offset-2"
      title="Show/hide role breakdown"
    >
      {formatMoney(entry.actualCost)} {expanded ? "▾" : "▸"}
    </button>
  );

  const actualCompleteCell = canWrite ? (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-slate-600">{formatPct(entry.pctActualComplete)}</span>
      <button
        onClick={() => startTransition(() => syncActualCompleteFromChecklist(entry.id, projectId))}
        disabled={pending}
        title="Sync from checklist"
        className="text-slate-300 hover:text-slate-700 disabled:opacity-50"
      >
        ↻
      </button>
    </div>
  ) : (
    formatPct(entry.pctActualComplete)
  );

  const breakdownRow = expanded && (
    <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60">
      <td colSpan={costHidden ? 6 : canWrite ? 11 : 10} className="px-4 pb-2">
        <BudgetEntryRoleCosts
          projectId={projectId}
          budgetEntryId={entry.id}
          roleCosts={entry.roleCosts}
          roster={roster}
          canWrite={canWrite}
        />
      </td>
    </tr>
  );

  if (!canWrite) {
    return (
      <>
        <tr className="group border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(entry.weekEnding)}</td>
          <td className="px-4 py-2.5 text-slate-600">{formatPct(entry.pctPlannedComplete)}</td>
          <td className="px-4 py-2.5 text-slate-600">{actualCompleteCell}</td>
          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
          {!costHidden && <td className="px-4 py-2.5 whitespace-nowrap">{acCell}</td>}
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
        {breakdownRow}
      </>
    );
  }

  return (
    <>
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
        <td className="px-4 py-2.5">{actualCompleteCell}</td>
        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
        <td className="px-4 py-2.5">{acCell}</td>
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
      {breakdownRow}
    </>
  );
}
