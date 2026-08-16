import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { wbsPlannedValue, wbsEarnedValue, wbsActualValue, competencyCpi } from "@/lib/calculations";
import { formatDate, toDateInputValue } from "@/lib/format";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { SubNav } from "@/components/ui/sub-nav";
import { AddWeekModal } from "./add-week-modal";
import { DeliveryWeekRow } from "./delivery-week-row";

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
  const access = await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [weeks, masterTasks, engagements] = await Promise.all([
    prisma.wbsWeek.findMany({
      where: { projectId: params.projectId },
      orderBy: { weekEnding: "asc" },
      include: { entries: { include: { wbsTask: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.wbsTask.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "asc" } }),
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: { include: { competency: true } } },
      orderBy: { person: { name: "asc" } },
    }),
  ]);

  const roster = Array.from(new Map(engagements.map((e) => [e.personId, e])).values()).map((e) => ({
    personId: e.person.id,
    personName: e.person.name,
    competencyLevel: e.person.competency?.level ?? null,
  }));

  const masterTaskOptions = masterTasks.map((t) => ({ id: t.id, wbsNumber: t.wbsNumber, title: t.title }));

  const weeksForRows = weeks.map((w) => ({
    id: w.id,
    weekEnding: w.weekEnding,
    entries: w.entries.map((e) => ({
      id: e.id,
      wbsTaskId: e.wbsTaskId,
      wbsNumber: e.wbsTask.wbsNumber,
      title: e.wbsTask.title,
      manDays: e.wbsTask.manDays,
      pctComplete: e.pctComplete,
      actualManDays: e.actualManDays,
      personId: e.personId,
      personName: e.personName,
    })),
  }));

  const rows = weeks.map((w) => {
    const tasksShape = w.entries.map((e) => ({ manDays: e.wbsTask.manDays, pctComplete: e.pctComplete }));
    const actualShape = w.entries.map((e) => ({ actualManDays: e.actualManDays, competencyMultiplier: e.competencyMultiplier }));
    const pv = wbsPlannedValue(tasksShape);
    const ev = wbsEarnedValue(tasksShape);
    const av = wbsActualValue(actualShape);
    return { id: w.id, weekEnding: w.weekEnding, pv, ev, av, cpi: competencyCpi(ev, av), spi: pv ? ev / pv : null };
  });

  const lastWeek = weeks[weeks.length - 1];
  const suggestedDate =
    toDateInputValue(lastWeek ? new Date(lastWeek.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date()) ?? "";

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Weekly CPI" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Weekly CPI</h2>
          <p className="text-sm text-slate-500">
            Are WBS tasks properly estimated? PV = planned man-days. EV = man-days × % complete. AV = real days spent
            × assignee&apos;s Competency multiplier. Competency CPI = EV/AV — &ge;1.0 means the work took less
            competency-adjusted effort than estimated (over-estimated); &lt;1.0 means it took more
            (under-estimated). Add tasks to a week from the project&apos;s WBS (Tasks tab) below.
          </p>
        </div>
        {canWrite && <AddWeekModal projectId={params.projectId} suggestedDate={suggestedDate} />}
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
        {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No tracking weeks yet.</p>}
      </div>

      <div className="space-y-3">
        {weeksForRows.map((w) => (
          <DeliveryWeekRow key={w.id} projectId={params.projectId} week={w} masterTasks={masterTaskOptions} roster={roster} canWrite={canWrite} />
        ))}
      </div>
    </div>
  );
}
