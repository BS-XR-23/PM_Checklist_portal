import { formatMoney, formatDate, formatPct } from "@/lib/format";
import { INDEX_BAND_COLORS, indexBand } from "@/lib/colors";
import type { EvmPoint } from "@/lib/calculations";

export type RoleBreakdownRow = { roleName: string; manDaysEquivalent: number; manDayRate: number; cost: number };

function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const band = INDEX_BAND_COLORS[indexBand(value)];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: band.bg, color: band.text }}
    >
      {value.toFixed(2)}
    </span>
  );
}

/** Fully read-only — every figure is derived live from Delivery's WBS tracking. */
export function BudgetRow({
  weekId,
  sprintName,
  evm,
  roleBreakdown,
  uncostedHours,
  costHidden,
}: {
  weekId: string;
  sprintName: string;
  evm: EvmPoint;
  roleBreakdown: RoleBreakdownRow[];
  uncostedHours: number;
  costHidden: boolean;
}) {
  return (
    <tr key={weekId} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="font-medium text-slate-800">{sprintName}</div>
        <div className="text-xs text-slate-500">ended {formatDate(evm.weekEnding)}</div>
      </td>
      <td className="px-4 py-2.5 text-slate-600">{formatPct(evm.pctPlannedComplete)}</td>
      <td className="px-4 py-2.5 text-slate-600">{formatPct(evm.pctActualComplete)}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.pv)}</td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatMoney(evm.ev)}</td>
      {!costHidden && (
        <td className="px-4 py-2.5 whitespace-nowrap">
          <div className="text-slate-600">{formatMoney(evm.actualCost)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">This sprint: {formatMoney(evm.sprintActualCost)}</div>
          {uncostedHours > 0 && (
            <div className="mt-0.5 text-[11px] font-medium text-amber-700" title="Assignee has no Role Rate (Admin → People), so these hours cost $0 here">
              + {uncostedHours.toFixed(1)}h not costed (no role rate)
            </div>
          )}
          {roleBreakdown.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {roleBreakdown.map((r) => (
                <div key={r.roleName} className="text-[11px] text-slate-400 whitespace-nowrap">
                  {r.roleName}: {r.manDaysEquivalent.toFixed(1)}md × {formatMoney(r.manDayRate)} = {formatMoney(r.cost)}
                </div>
              ))}
            </div>
          )}
        </td>
      )}
      {!costHidden && (
        <td className="px-4 py-2.5 whitespace-nowrap">
          <div className="text-slate-700">{formatMoney(evm.cv)}</div>
          <div className="text-[11px] text-slate-500">{evm.margin != null ? `${formatPct(evm.margin)} of earned` : "nothing earned yet"}</div>
        </td>
      )}
      {!costHidden && (
        <td className="px-4 py-2.5 whitespace-nowrap">
          <IndexValue value={evm.spi} />
        </td>
      )}
    </tr>
  );
}
