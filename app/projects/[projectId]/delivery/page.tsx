import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { wbsPlannedValue, wbsEarnedValue, wbsActualValue, competencyCpi } from "@/lib/calculations";
import { formatDate } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { SubNav } from "@/components/ui/sub-nav";

export const dynamic = "force-dynamic";

function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const favorable = value >= 1;
  const color = favorable ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: favorable ? "#E6F4EC" : "#FBE9E9", color }}
    >
      {value.toFixed(2)}
    </span>
  );
}

export default async function DeliveryWeeklyCpiPage({ params }: { params: { projectId: string } }) {
  await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");

  const weeks = await prisma.wbsWeek.findMany({
    where: { projectId: params.projectId },
    orderBy: { weekEnding: "asc" },
    include: { tasks: true },
  });

  const rows = weeks.map((w) => {
    const pv = wbsPlannedValue(w.tasks);
    const ev = wbsEarnedValue(w.tasks);
    const av = wbsActualValue(w.tasks);
    return { id: w.id, weekEnding: w.weekEnding, pv, ev, av, cpi: competencyCpi(ev, av), spi: pv ? ev / pv : null };
  });

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Weekly CPI" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Weekly CPI</h2>
        <p className="text-sm text-slate-500">
          Are WBS tasks properly estimated? PV = planned man-days. EV = man-days × % complete. AV = real days spent ×
          assignee&apos;s Competency multiplier. Competency CPI = EV/AV — &ge;1.0 means the work took less
          competency-adjusted effort than estimated (over-estimated); &lt;1.0 means it took more (under-estimated).
          All figures are in man-days, not currency — edit tasks on the Tasks tab.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium w-36">Week Ending</th>
                <th className="px-4 py-3 font-medium w-28">PV (md)</th>
                <th className="px-4 py-3 font-medium w-28">EV (md)</th>
                <th className="px-4 py-3 font-medium w-28">AV (md)</th>
                <th className="px-4 py-3 font-medium w-24">EV/PV</th>
                <th className="px-4 py-3 font-medium w-32">Competency CPI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(r.weekEnding)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.pv.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.ev.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.av.toFixed(1)}</td>
                  <td className="px-4 py-2.5">
                    <IndexValue value={r.spi} />
                  </td>
                  <td className="px-4 py-2.5">
                    <IndexValue value={r.cpi} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No WBS weeks yet — add one on the Tasks tab.</p>}
      </div>
    </div>
  );
}
