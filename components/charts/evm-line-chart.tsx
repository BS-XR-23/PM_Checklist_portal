"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_SERIES, CHART_CHROME } from "@/lib/chart-colors";
import { formatMoney, formatDate } from "@/lib/format";

export type EvmChartPoint = {
  weekEnding: string;
  pv: number;
  ev: number;
  ac: number;
};

export function EvmLineChart({ data }: { data: EvmChartPoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="Add weekly entries below to see the PV / EV / AC S-curve." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
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
          tickFormatter={(v) => formatMoney(v)}
          tick={{ fill: CHART_CHROME.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          formatter={(value) => formatMoney(Number(value))}
          labelFormatter={(label) => formatDate(label as string)}
          contentStyle={{ borderRadius: 8, borderColor: CHART_CHROME.gridline, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_CHROME.textSecondary }} />
        <Line type="monotone" dataKey="pv" name="Planned Value (PV)" stroke={CHART_SERIES.blue} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="ev" name="Earned Value (EV)" stroke={CHART_SERIES.orange} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="ac" name="Actual Cost (AC)" stroke={CHART_SERIES.aqua} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{message}</div>;
}
