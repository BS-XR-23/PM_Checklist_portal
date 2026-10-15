import { formatMoney, formatPct } from "@/lib/format";
import type { MoneySplit } from "@/lib/milestones";

/** The contract split four ways (lib/milestones.ts contractMoneySplit) — shared by the Dashboard and Milestones & Payments. */
export function MoneyBar({ money }: { money: MoneySplit }) {
  const segments = [
    { label: "Collected", amount: money.collected, color: "#16A34A" },
    { label: "Invoiced, awaiting payment", amount: money.awaiting, color: "#F59E0B" },
    { label: "On milestones, not invoiced", amount: money.scheduled, color: "#93C5FD" },
    { label: "Not on any milestone", amount: money.unallocated, color: "#E2E8F0" },
  ];
  return (
    <>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((sg) =>
          sg.amount > 0 ? <div key={sg.label} title={`${sg.label}: ${formatMoney(sg.amount)}`} style={{ width: `${(sg.amount / money.contractValue) * 100}%`, backgroundColor: sg.color }} /> : null
        )}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {segments.map((sg) => (
          <li key={sg.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sg.color }} />
              {sg.label}
            </span>
            <span className="font-semibold text-slate-800">
              {formatMoney(sg.amount)} <span className="font-normal text-slate-400">{formatPct(sg.amount / money.contractValue)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
