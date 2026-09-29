import { formatShortDate } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/colors";
import type { ItemStatus } from "@/lib/constants";

export type GanttRow = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  /** Humanized status text ("Not Started" / "In Progress" / "Completed", etc.) — mapped to STATUS_COLORS for the bar color. */
  status?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// TimelineRow/MilestoneStatus store humanized labels ("In Progress"), not
// the ItemStatus enum key STATUS_COLORS is keyed by — same mapping
// components/pm-plan/timeline-table.tsx uses for its status <select> chip.
function statusColor(status: string | undefined): string {
  const key: ItemStatus = status === "Completed" ? "COMPLETED" : status === "In Progress" ? "IN_PROGRESS" : "NOT_STARTED";
  return STATUS_COLORS[key].bg;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/**
 * Lightweight Gantt-style bar chart — same hand-rolled div-positioning
 * approach as TimelineStrip (no charting library involved; recharts has no
 * native Gantt primitive and faking one with its stacked-bar trick is more
 * code than this), extended with a month-tick date axis and a "today"
 * marker since this chart stands alone rather than sitting next to a table
 * with the exact dates already visible in text.
 */
export function GanttChart({ rows, emptyText = "No phases with both a start and end date yet." }: { rows: GanttRow[]; emptyText?: string }) {
  const plottable = rows.filter((r) => r.start && r.end && r.end >= r.start);
  if (plottable.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>;
  }

  const min = new Date(Math.min(...plottable.map((r) => r.start.getTime())));
  const max = new Date(Math.max(...plottable.map((r) => r.end.getTime())));
  const axisStart = startOfMonth(min);
  // End-exclusive: the axis spans up to (but not including) the month after
  // the last bar's end, so that end date's own month still gets a full tick.
  const axisEnd = addMonths(startOfMonth(max), 1);
  const span = Math.max(axisEnd.getTime() - axisStart.getTime(), DAY_MS);

  const months: Date[] = [];
  for (let m = axisStart; m < axisEnd; m = addMonths(m, 1)) months.push(m);

  const pct = (d: Date) => ((d.getTime() - axisStart.getTime()) / span) * 100;

  const today = new Date();
  const todayPct = today >= axisStart && today < axisEnd ? pct(today) : null;

  return (
    <div className="space-y-2">
      <div className="flex text-[11px] text-slate-400 pl-40">
        <div className="flex-1 relative h-4">
          {months.map((m) => (
            <span key={m.toISOString()} className="absolute -translate-x-1/2" style={{ left: `${pct(m)}%` }}>
              {m.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const hasDates = row.start && row.end && row.end >= row.start;
          const left = hasDates ? pct(row.start) : 0;
          const width = hasDates ? Math.max(pct(row.end) - pct(row.start), 1) : 0;
          return (
            <div key={row.id} className="flex items-center gap-3 text-xs">
              <div className="w-40 shrink-0 text-slate-600 truncate" title={row.label}>
                {row.label}
              </div>
              <div className="flex-1 relative h-5 rounded bg-slate-50">
                {months.map((m) => (
                  <span key={m.toISOString()} className="absolute top-0 bottom-0 w-px bg-slate-100" style={{ left: `${pct(m)}%` }} />
                ))}
                {todayPct !== null && <span className="absolute top-0 bottom-0 w-px bg-red-300" style={{ left: `${todayPct}%` }} />}
                {hasDates && (
                  <div
                    className="absolute h-5 rounded"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: statusColor(row.status) }}
                    title={`${row.label}: ${formatShortDate(row.start)} → ${formatShortDate(row.end)}${row.status ? ` (${row.status})` : ""}`}
                  />
                )}
              </div>
              <div className="w-32 shrink-0 text-slate-400 text-right">{hasDates ? `${formatShortDate(row.start)} → ${formatShortDate(row.end)}` : "—"}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 pt-1 pl-40 text-xs text-slate-500">
        {(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS[key].bg }} /> {STATUS_COLORS[key].label}
          </span>
        ))}
        {todayPct !== null && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 inline-block bg-red-300" /> Today
          </span>
        )}
      </div>
    </div>
  );
}
