"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { STATUS_COLORS } from "@/lib/colors";
import type { ItemStatus } from "@/lib/constants";
import { CHART_CHROME } from "@/lib/chart-colors";

export function StatusPieChart({ data }: { data: { status: ItemStatus; count: number }[] }) {
  const chartData = data.filter((d) => d.count > 0);

  if (chartData.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-slate-400">No checklist items yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          label={(props) => (props as unknown as { count: number }).count}
          labelLine={false}
        >
          {chartData.map((d) => (
            <Cell key={d.status} fill={STATUS_COLORS[d.status].bg} stroke={CHART_CHROME.surface} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => [value, STATUS_COLORS[(item.payload as { status: ItemStatus }).status].label]}
          contentStyle={{ borderRadius: 8, borderColor: CHART_CHROME.gridline, fontSize: 13 }}
        />
        <Legend
          formatter={(_value, entry) => {
            const status = (entry.payload as unknown as { status: ItemStatus })?.status;
            return <span style={{ color: CHART_CHROME.textSecondary, fontSize: 12 }}>{status ? STATUS_COLORS[status].label : ""}</span>;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
