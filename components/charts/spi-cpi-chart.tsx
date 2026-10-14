"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";
import { CHART_SERIES, CHART_CHROME } from "@/lib/chart-colors";
import { formatDate } from "@/lib/format";
import { EmptyState } from "./evm-line-chart";

export type SpiCpiPoint = {
  weekEnding: string;
  spi: number | null;
  cpi: number | null;
};

// secondLabel: Budget Tracker plots dollar CPI in the second series;
// Portfolio plots the Effort Index there instead (lib/project-health.ts).
export function SpiCpiChart({ data, secondLabel = "CPI (EV/AC)" }: { data: SpiCpiPoint[]; secondLabel?: string }) {
  const hasValues = data.some((d) => d.spi != null || d.cpi != null);
  if (!hasValues) {
    return <EmptyState message="No started sprints with committed story points yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.gridline} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="weekEnding"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fill: CHART_CHROME.muted, fontSize: 12 }}
          axisLine={{ stroke: CHART_CHROME.baseline }}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: CHART_CHROME.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <ReferenceLine y={1} stroke={CHART_CHROME.baseline} strokeDasharray="0" label={{ value: "1.0", fontSize: 11, fill: CHART_CHROME.muted }} />
        <Tooltip
          formatter={(value) => Number(value).toFixed(2)}
          labelFormatter={(label) => formatDate(label as string)}
          contentStyle={{ borderRadius: 8, borderColor: CHART_CHROME.gridline, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_CHROME.textSecondary }} />
        <Line type="monotone" dataKey="spi" name="SPI (EV/PV)" stroke={CHART_SERIES.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="cpi" name={secondLabel} stroke={CHART_SERIES.orange} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
