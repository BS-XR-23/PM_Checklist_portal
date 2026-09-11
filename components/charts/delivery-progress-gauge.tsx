"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { CHART_SERIES, CHART_CHROME } from "@/lib/chart-colors";
import { formatPct } from "@/lib/format";

/** A single-value radial gauge — average delivery progress across whatever
 * project set the caller passes in. No existing recharts gauge/radial
 * precedent in this app; built to match the same CHART_CHROME/CHART_SERIES
 * conventions as the other chart components rather than introducing new
 * colors. `size` controls both the chart and the center label so it can sit
 * compactly alongside the other Portfolio Trends panels. */
export function DeliveryProgressGauge({ value, label, size = 180 }: { value: number; label: string; size?: number }) {
  const pct = Math.round(value * 100);
  const data = [{ name: label, value: pct, fill: CHART_SERIES.blue }];
  const compact = size < 140;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={size}>
        <RadialBarChart data={data} innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={compact ? 9 : 14}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={7} background={{ fill: CHART_CHROME.gridline }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={compact ? "text-base font-bold text-slate-900" : "text-2xl font-bold text-slate-900"}>{formatPct(value)}</span>
        {!compact && <span className="text-xs text-slate-500">{label}</span>}
      </div>
    </div>
  );
}
