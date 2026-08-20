"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

/** Compact trend line for a StatTile subtitle slot — no axes/grid/tooltip,
 * just enough to show "trending up or down" at a glance next to the number. */
export function SpiSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="h-6 w-full max-w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
