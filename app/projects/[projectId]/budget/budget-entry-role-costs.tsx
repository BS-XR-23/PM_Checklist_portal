"use client";

import { useState, useTransition } from "react";
import { InlineNumber } from "@/components/ui/inline-edit";
import { formatMoney } from "@/lib/format";
import { addBudgetEntryRoleCost, updateBudgetEntryRoleCost, deleteBudgetEntryRoleCost } from "./budget-actions";

export type RoleCostData = { id: string; personId: string | null; personName: string | null; roleName: string; manDayRate: number; manDays: number };
export type RosterPerson = { personId: string; personName: string; roleName: string | null; manDayRate: number | null };

function PersonSelect({
  rowId,
  projectId,
  value,
  roster,
}: {
  rowId: string;
  projectId: string;
  value: string;
  roster: RosterPerson[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-[200px]">
      <select
        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await updateBudgetEntryRoleCost(rowId, projectId, { personId: e.target.value });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to set person.");
            }
          });
        }}
      >
        <option value="">— Choose person —</option>
        {roster.map((p) => (
          <option key={p.personId} value={p.personId}>
            {p.personName}
            {p.roleName ? ` — ${p.roleName}` : " — no rate set"}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

export function BudgetEntryRoleCosts({
  projectId,
  budgetEntryId,
  roleCosts,
  roster,
  canWrite,
}: {
  projectId: string;
  budgetEntryId: string;
  roleCosts: RoleCostData[];
  roster: RosterPerson[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (roleCosts.length === 0 && !canWrite) {
    return <p className="text-xs text-slate-400 py-2">No role/man-days breakdown logged for this week.</p>;
  }

  return (
    <div className="py-2 space-y-1.5">
      {roleCosts.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-xs">
          {canWrite ? (
            <PersonSelect rowId={r.id} projectId={projectId} value={r.personId ?? ""} roster={roster} />
          ) : (
            <span className="min-w-[200px] text-slate-600">
              {r.personName ?? "—"}
              {r.roleName ? ` — ${r.roleName}` : ""}
            </span>
          )}

          {canWrite ? (
            <div className="w-20">
              <InlineNumber value={r.manDays} step={0.5} onSave={(v) => updateBudgetEntryRoleCost(r.id, projectId, { manDays: v ?? 0 })} />
            </div>
          ) : (
            <span className="w-20 text-slate-600">{r.manDays} MD</span>
          )}

          <span className="text-slate-400 w-16">@ {formatMoney(r.manDayRate)}</span>
          <span className="text-slate-700 font-medium w-24">{formatMoney(r.manDays * r.manDayRate)}</span>

          {canWrite && (
            <button
              onClick={() => startTransition(() => deleteBudgetEntryRoleCost(r.id, projectId))}
              disabled={pending}
              title="Remove role"
              className="text-slate-300 hover:text-red-600 disabled:opacity-50"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {canWrite && roster.length === 0 && (
        <p className="text-xs text-slate-400">No one is engaged on this project yet — assign people on the Team → Engagement tab.</p>
      )}

      {canWrite && (
        <button
          onClick={() => startTransition(() => addBudgetEntryRoleCost(budgetEntryId, projectId))}
          disabled={pending}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          + Add role
        </button>
      )}
    </div>
  );
}
