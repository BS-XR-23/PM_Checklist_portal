"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer, Cell } from "recharts";
import { CHART_SERIES, CHART_CHROME } from "@/lib/chart-colors";
import { formatPct } from "@/lib/format";

export function CompletionBarChart({ data }: { data: { name: string; pct: number }[] }) {
  const colors = [CHART_SERIES.blue, CHART_SERIES.orange];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 32, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.gridline} strokeDasharray="0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => formatPct(v)}
          tick={{ fill: CHART_CHROME.muted, fontSize: 12 }}
          axisLine={{ stroke: CHART_CHROME.baseline }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: CHART_CHROME.textSecondary, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip formatter={(value) => formatPct(Number(value))} contentStyle={{ borderRadius: 8, borderColor: CHART_CHROME.gridline, fontSize: 13 }} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={colors[i % colors.length]} />
          ))}
          <LabelList dataKey="pct" position="right" formatter={(v) => formatPct(Number(v))} fill={CHART_CHROME.textSecondary} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
