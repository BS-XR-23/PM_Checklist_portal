import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { wbsPlannedValue, wbsActualValue, sprintEarnedValue } from "@/lib/calculations";
import { toDateInputValue } from "@/lib/format";
import { SubNav } from "@/components/ui/sub-nav";
import { AddWeekModal } from "./add-week-modal";
import { DeliveryWeekRow } from "./delivery-week-row";
import { SprintSummaryRow, type SprintSummaryData } from "./sprint-summary-row";

export const dynamic = "force-dynamic";

export default async function DeliveryWeeklyTrackingPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [weeks, masterTasks, engagements, sprints] = await Promise.all([
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
    prisma.sprint.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: { include: { entries: { include: { wbsWeek: true } } } },
        allocations: { include: { person: { include: { competency: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  const roster = Array.from(new Map(engagements.map((e) => [e.personId, e])).values()).map((e) => ({
    personId: e.person.id,
    personName: e.person.name,
    competencyLevel: e.person.competency?.level ?? null,
  }));

  const masterTaskOptions = masterTasks.map((t) => ({ id: t.id, wbsNumber: t.wbsNumber, title: t.title }));
  const sprintNameById = new Map(sprints.map((s) => [s.id, s.name]));
  const taskSprintById = new Map(masterTasks.map((t) => [t.id, t.sprintId ? sprintNameById.get(t.sprintId) ?? null : null]));

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
      sprintName: taskSprintById.get(e.wbsTaskId) ?? null,
    })),
  }));

  // Open sprints: PV/EV/AV computed live from current WbsTask/WbsWeekEntry
  // state (0/100 rule for EV — see sprintEarnedValue). Closed sprints read
  // their permanent frozen* snapshot instead of recomputing — see
  // closeSprint in delivery-actions.ts for why.
  const sprintSummaries: SprintSummaryData[] = sprints.map((s) => {
    const taskDrillDowns = s.tasks.map((t) => {
      const latest = [...t.entries].sort((a, b) => b.wbsWeek.weekEnding.getTime() - a.wbsWeek.weekEnding.getTime())[0];
      return {
        id: t.id,
        wbsNumber: t.wbsNumber,
        title: t.title,
        manDays: t.manDays,
        storyPoints: t.storyPoints,
        pctComplete: latest?.pctComplete ?? 0,
      };
    });

    const pv = s.closedAt ? s.frozenPlannedManDays ?? 0 : wbsPlannedValue(s.tasks.map((t) => ({ manDays: t.manDays })));
    const ev = s.closedAt ? s.frozenEarnedManDays ?? 0 : sprintEarnedValue(taskDrillDowns.map((t) => ({ manDays: t.manDays, pctComplete: t.pctComplete })));
    const av = s.closedAt
      ? s.frozenActualValue ?? 0
      : wbsActualValue(s.tasks.flatMap((t) => t.entries.map((e) => ({ actualManDays: e.actualManDays, competencyMultiplier: e.competencyMultiplier }))));

    const allocations = s.allocations.map((a) => ({
      id: a.id,
      personId: a.personId,
      personName: a.person.name,
      competencyLevel: a.person.competency?.level ?? null,
      allocationPct: a.allocationPct,
      jiraHours: a.jiraHours,
    }));

    return { id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, closedAt: s.closedAt, pv, ev, av, tasks: taskDrillDowns, allocations };
  });

  const lastWeek = weeks[weeks.length - 1];
  const suggestedDate =
    toDateInputValue(lastWeek ? new Date(lastWeek.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date()) ?? "";

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Weekly Tracking" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Weekly Tracking</h2>
          <p className="text-sm text-slate-500">
            Update each committed task&apos;s % complete and actual man-days here, week by week — this feeds the
            Sprint Summary above (PV/EV/AV/CPI, via the 0/100 rule). Add tasks to a week from the project&apos;s WBS
            (Tasks tab) below.
          </p>
        </div>
        {canWrite && <AddWeekModal projectId={params.projectId} suggestedDate={suggestedDate} />}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Sprints</h3>
        {sprintSummaries.length > 0 ? (
          <>
            <p className="text-xs text-slate-500 -mt-2">
              0/100 rule: a committed task earns its full man-days only once it&apos;s fully done. Story Points shown
              per task are for velocity reference only. Close a sprint to freeze its numbers permanently once it
              ends.
            </p>
            {sprintSummaries.map((s) => (
              <SprintSummaryRow key={s.id} projectId={params.projectId} sprint={s} roster={roster} canWrite={canWrite} />
            ))}
          </>
        ) : (
          <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
            No sprints yet — create one and commit tasks to it on the Tasks tab to see PV/EV/AV/CPI here.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {weeksForRows.map((w) => (
          <DeliveryWeekRow key={w.id} projectId={params.projectId} week={w} masterTasks={masterTaskOptions} roster={roster} canWrite={canWrite} />
        ))}
        {weeksForRows.length === 0 && (
          <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No tracking weeks yet.</p>
        )}
      </div>
    </div>
  );
}
