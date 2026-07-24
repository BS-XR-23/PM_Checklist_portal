import { formatDate } from "@/lib/format";
import { CHART_SERIES } from "@/lib/chart-colors";

export type TimelineRow = {
  stage: string;
  source: string;
  start: Date | null;
  end: Date | null;
};

export function TimelineStrip({ rows }: { rows: TimelineRow[] }) {
  const withDates = rows.filter((r) => r.start && r.end) as { stage: string; source: string; start: Date; end: Date }[];

  if (withDates.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Add Planned and Forecast dates on the checklists to populate the timeline.
      </p>
    );
  }

  const min = Math.min(...withDates.map((r) => r.start.getTime()));
  const max = Math.max(...withDates.map((r) => r.end.getTime()));
  const span = Math.max(max - min, 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const hasDates = row.start && row.end;
        const left = hasDates ? ((row.start!.getTime() - min) / span) * 100 : 0;
        const width = hasDates ? Math.max(((row.end!.getTime() - row.start!.getTime()) / span) * 100, 1.5) : 0;
        return (
          <div key={`${row.source}-${row.stage}`} className="flex items-center gap-3 text-xs">
            <div className="w-40 shrink-0 text-slate-600 truncate" title={row.stage}>
              {row.stage}
            </div>
            <div className="flex-1 relative h-4 rounded bg-slate-100">
              {hasDates && (
                <div
                  className="absolute h-4 rounded"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: row.source === "PM Checklist" ? CHART_SERIES.blue : CHART_SERIES.orange,
                  }}
                  title={`${formatDate(row.start)} → ${formatDate(row.end)}`}
                />
              )}
            </div>
            <div className="w-40 shrink-0 text-slate-400 text-right">
              {hasDates ? `${formatDate(row.start)} → ${formatDate(row.end)}` : "—"}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: CHART_SERIES.blue }} /> PM Checklist
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: CHART_SERIES.orange }} /> DevOps Checklist
        </span>
      </div>
    </div>
  );
}
