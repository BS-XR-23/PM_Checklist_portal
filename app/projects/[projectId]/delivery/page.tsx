import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireUser } from "@/lib/rbac";
import { wbsPlannedValue, wbsActualValue, sprintEarnedValue, manDaysFromHours } from "@/lib/calculations";
import { SubNav } from "@/components/ui/sub-nav";
import { SprintSummaryRow, type SprintSummaryData, type FrozenTaskSnapshotEntry } from "./sprint-summary-row";

export const dynamic = "force-dynamic";

export default async function DeliverySprintsPage({ params }: { params: { projectId: string } }) {
  const [access, user] = await Promise.all([
    requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED"),
    requireUser(),
  ]);
  const canWrite = access === "WRITE";
  // Renaming/re-dating or deleting a sprint is an Admin-only emergency/
  // reorganize tool (see requireSprintAdmin in delivery-actions.ts) — a
  // stricter gate than the normal Delivery WRITE access PMs have.
  const isAdmin = user.role === "ADMIN";

  const [sprints, engagements] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: { orderBy: { createdAt: "asc" } },
        allocations: { include: { person: { include: { competency: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
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

  // Open sprints: PV/EV/AV computed live from current WbsTask state (0/100
  // rule for EV — see sprintEarnedValue). Closed sprints read their
  // permanent frozen* snapshot (including frozenTaskSnapshot, the
  // drill-down list) instead of recomputing — see closeSprint in
  // delivery-actions.ts for why.
  const sprintSummaries: SprintSummaryData[] = sprints.map((s) => {
    const pv = s.closedAt ? s.frozenPlannedPoints ?? 0 : wbsPlannedValue(s.tasks.map((t) => ({ points: t.storyPoints })));
    const ev = s.closedAt
      ? s.frozenEarnedPoints ?? 0
      : sprintEarnedValue(s.tasks.map((t) => ({ points: t.storyPoints, pctComplete: t.pctComplete })));
    const av = s.closedAt
      ? s.frozenActualValue ?? 0
      : wbsActualValue(s.tasks.map((t) => ({ actualManDays: manDaysFromHours(t.actualHours), competencyMultiplier: t.competencyMultiplier })));

    const tasks = s.tasks.map((t) => ({
      id: t.id,
      wbsNumber: t.wbsNumber,
      title: t.title,
      storyPoints: t.storyPoints,
      pctComplete: t.pctComplete,
      actualHours: t.actualHours,
      personId: t.personId,
      personName: t.personName,
    }));

    const frozenTasks = Array.isArray(s.frozenTaskSnapshot) ? (s.frozenTaskSnapshot as unknown as FrozenTaskSnapshotEntry[]) : [];

    const allocations = s.allocations.map((a) => ({
      id: a.id,
      personId: a.personId,
      personName: a.person.name,
      competencyLevel: a.person.competency?.level ?? null,
      allocationPct: a.allocationPct,
      jiraHours: a.jiraHours,
    }));

    return { id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, closedAt: s.closedAt, pv, ev, av, tasks, frozenTasks, allocations };
  });

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Sprints" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Sprints</h2>
        <p className="text-sm text-slate-500">
          0/100 rule: a committed task earns its full story points only once it&apos;s fully done. Update % complete,
          actual hours (e.g. read off Jira), and assignee directly on each task below. Close a sprint to freeze its
          PV/EV/AV permanently once it ends. Commit tasks to a sprint on the Tasks tab.
        </p>
      </div>

      <div className="space-y-3">
        {sprintSummaries.length > 0 ? (
          sprintSummaries.map((s) => (
            <SprintSummaryRow key={s.id} projectId={params.projectId} sprint={s} roster={roster} canWrite={canWrite} isAdmin={isAdmin} />
          ))
        ) : (
          <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
            No sprints yet — create one and commit tasks to it on the Tasks tab.
          </p>
        )}
      </div>
    </div>
  );
}
