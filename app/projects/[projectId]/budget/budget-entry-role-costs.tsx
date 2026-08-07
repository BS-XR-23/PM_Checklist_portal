"use client";

import { useTransition } from "react";
import { InlineNumber, InlineSelect } from "@/components/ui/inline-edit";
import { formatMoney } from "@/lib/format";
import { addBudgetEntryRoleCost, updateBudgetEntryRoleCost, deleteBudgetEntryRoleCost } from "./budget-actions";

export type RoleCostData = { id: string; roleRateId: string | null; roleName: string; manDayRate: number; manDays: number };
export type RoleRateOption = { id: string; roleName: string; manDayRate: number };

export function BudgetEntryRoleCosts({
  projectId,
  budgetEntryId,
  roleCosts,
  roleRates,
  canWrite,
}: {
  projectId: string;
  budgetEntryId: string;
  roleCosts: RoleCostData[];
  roleRates: RoleRateOption[];
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
            <InlineSelect
              className="rounded border border-slate-200 px-1.5 py-1 text-xs min-w-[160px]"
              value={r.roleRateId ?? ""}
              options={["", ...roleRates.map((rr) => rr.id)]}
              renderOption={(id) => {
                if (id === "") return "— Choose role —";
                const rr = roleRates.find((rr) => rr.id === id);
                return rr ? rr.roleName : id;
              }}
              onSave={(v) => updateBudgetEntryRoleCost(r.id, projectId, { roleRateId: v })}
            />
          ) : (
            <span className="min-w-[160px] text-slate-600">{r.roleName || "—"}</span>
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
