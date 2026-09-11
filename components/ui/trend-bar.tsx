/** A single labeled horizontal bar, sized relative to `max` — used for
 * simple count/value breakdowns (Projects by Stage, Contract Value by
 * Project) where a full chart is overkill. Extracted from app/portfolio's
 * own local copy so the Projects list can use the identical component
 * instead of re-implementing it. */
export function TrendBar({ label, value, max, format }: { label: string; value: number; max: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="w-40 shrink-0 truncate text-xs text-slate-600" title={label}>
        {label}
      </p>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <p className="w-20 shrink-0 text-right text-xs text-slate-500">{format ? format(value) : value}</p>
    </div>
  );
}
