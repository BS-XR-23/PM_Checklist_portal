import { formatMoney, formatDate, formatPct } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import type { EvmPoint } from "@/lib/calculations";

export type RoleBreakdownRow = { roleName: string; manDays: number; manDayRate: number; cost: number };

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

/** Fully read-only — every figure is derived live from Delivery's WBS tracking. */
export function BudgetRow({
  weekId,
  evm,
  roleBreakdown,
  costHidden,
}: {
  weekId: string;
  evm: EvmPoint;
  roleBreakdown: RoleBreakdownRow[];
  costHidden: boolean;
}) {
  return (
    <tr key={weekId} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(evm.weekEnding)}</td>
      <td className="px-4 py-2.5 text-slate-600">{formatPct(evm.pctPlannedComplete)}</td>
      <td className="px-4 py-2.5 text-slate-600">{formatPct(evm.pctActualComplete)}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
      {!costHidden && (
        <td className="px-4 py-2.5 whitespace-nowrap">
          <div className="text-slate-600">{formatMoney(evm.actualCost)}</div>
          {roleBreakdown.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {roleBreakdown.map((r) => (
                <div key={r.roleName} className="text-[11px] text-slate-400 whitespace-nowrap">
                  {r.roleName}: {r.manDays.toFixed(1)}md × {formatMoney(r.manDayRate)} = {formatMoney(r.cost)}
                </div>
              ))}
            </div>
          )}
        </td>
      )}
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
    </tr>
  );
}
