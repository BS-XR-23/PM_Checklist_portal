"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { RAG_COLORS } from "@/lib/rag";
import { CHART_CHROME } from "@/lib/chart-colors";

const COMPLETED_COLOR = { bg: "#E2E8F0", text: "#475569" };

/** Compact donut with the total in the center and a small dot-legend beside
 * it (not recharts' own Legend/on-slice labels — too cramped at this size) —
 * same RAG_COLORS source as every other RAG badge in the app. */
export function HealthDonutChart({
  healthy,
  atRisk,
  critical,
  completed,
  size = 130,
}: {
  healthy: number;
  atRisk: number;
  critical: number;
  completed: number;
  /** Chart diameter in px — legend/center-total text and the ring's radii
   * scale with it so this still reads cleanly shrunk down for a compact
   * panel, not just a smaller crop of the default size. */
  size?: number;
}) {
  const slices = [
    { name: "Healthy", value: healthy, color: RAG_COLORS.GREEN.bg },
    { name: "At Risk", value: atRisk, color: RAG_COLORS.AMBER.bg },
    { name: "Critical", value: critical, color: RAG_COLORS.RED.bg },
    { name: "Completed", value: completed, color: COMPLETED_COLOR.bg },
  ];
  const total = healthy + atRisk + critical + completed;
  const data = slices.filter((d) => d.value > 0);
  const compact = size < 100;

  if (total === 0) {
    return <div className="h-28 flex items-center justify-center text-xs text-slate-400">No projects yet.</div>;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size }}>
        <ResponsiveContainer width="100%" height={size}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={size * 0.29}
              outerRadius={size * 0.45}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} stroke={CHART_CHROME.surface} strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={compact ? "text-sm font-bold text-slate-900" : "text-xl font-bold text-slate-900"}>{total}</span>
        </div>
      </div>
      <ul className={compact ? "space-y-0.5" : "space-y-1"}>
        {slices.map((d) => (
          <li key={d.name} className="flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            {d.name} {d.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
