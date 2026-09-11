import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireUser } from "@/lib/rbac";
import { compareWbsNumbers } from "@/lib/format";
import { liveSprintContribution, parseSprintContributions, sprintTotalsFromContributions, sprintOwnHours } from "@/lib/calculations";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { IconLayers, IconClock, IconCheckCircle, IconClipboardList } from "@/components/layout/icons";
import { AddSprintModal } from "../add-sprint-modal";
import { SprintPlaybookModal } from "../sprint-playbook-modal";
import { SprintSummaryRow, type SprintSummaryData, type FrozenTaskSnapshotEntry } from "../sprint-summary-row";

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

  const [sprints, engagements, backlog] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: { orderBy: { createdAt: "asc" }, include: { person: { include: { roleRate: true } } } },
        allocations: { include: { person: { include: { competency: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: { include: { competency: true } } },
      orderBy: { person: { name: "asc" } },
    }),
    // Tasks not yet committed to any sprint — what the Sprint panel's
    // "import from backlog" picker offers. The Tasks tab stays the only
    // place a task is *defined*; committing it is what the Sprint panel does.
    prisma.wbsTask.findMany({
      where: { projectId: params.projectId, sprintId: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const backlogTasks = backlog.map((t) => ({ id: t.id, wbsNumber: t.wbsNumber, title: t.title, storyPoints: t.storyPoints }));

  // Every WbsTask in the project is either sitting in the backlog or
  // committed to one of these sprints — no extra query needed to get the
  // full list for duplicate-title detection inside the Sprint popup.
  const allProjectTasks = [...backlog, ...sprints.flatMap((s) => s.tasks)].map((t) => ({
    id: t.id,
    wbsNumber: t.wbsNumber,
    title: t.title,
  }));

  // For the close-triage panel: which other sprints a spillover task could
  // move into right now (self excluded per-row below).
  const openSprints = sprints.filter((s) => !s.closedAt).map((s) => ({ id: s.id, name: s.name }));

  const roster = Array.from(new Map(engagements.map((e) => [e.personId, e])).values()).map((e) => ({
    personId: e.person.id,
    personName: e.person.name,
    competencyLevel: e.person.competency?.level ?? null,
  }));

  // Open sprints: PV/EV/AV computed live from current WbsTask state (0/100
  // rule for EV — see sprintEarnedValue), unioned with departedTaskSnapshot
  // so a task moved elsewhere or uncommitted mid-flight doesn't silently
  // drop out of the totals it already earned here (see assignTaskToSprint).
  // Closed sprints read their permanent frozen* snapshot (including
  // frozenTaskSnapshot, the drill-down list) instead of recomputing — see
  // closeSprint in delivery-actions.ts for why.
  const sprintSummaries: SprintSummaryData[] = sprints.map((s) => {
    const departedEntries = parseSprintContributions(s.departedTaskSnapshot);
    const liveEntries = s.tasks.map(liveSprintContribution);
    const { plannedValue: pv, earnedValue: ev, actualValue: av } = s.closedAt
      ? { plannedValue: s.frozenPlannedPoints ?? 0, earnedValue: s.frozenEarnedPoints ?? 0, actualValue: s.frozenActualValue ?? 0 }
      : sprintTotalsFromContributions([...liveEntries, ...departedEntries]);

    // Same natural WBS# sort as the Tasks tab, not commit order — a PM
    // scanning a sprint's drill-down expects it grouped the same way.
    const tasks = [...s.tasks]
      .sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber))
      .map((t) => ({
        id: t.id,
        wbsNumber: t.wbsNumber,
        title: t.title,
        storyPoints: t.storyPoints,
        pctComplete: t.pctComplete,
        // Sprint-scoped, not the task's lifetime total (that's the Task
        // tab's job) — see sprintOwnHours in lib/calculations.ts. Paired
        // with sprintEntryHours so the row's edit can translate back to
        // the absolute value actually stored on WbsTask.
        actualHours: sprintOwnHours(t.actualHours, t.sprintEntryHours),
        sprintEntryHours: t.sprintEntryHours,
        personId: t.personId,
        personName: t.personName,
      }));

    // Tasks that left this (still-open) sprint mid-flight — shown as a
    // read-only tail below the live rows so a PM can see the sprint still
    // accounts for them, not just its live total. Closed sprints don't
    // need this separately: their departures are already folded into
    // frozenTaskSnapshot at close time.
    const departedTasks = s.closedAt
      ? []
      : [...departedEntries].sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber));

    const frozenTasks = Array.isArray(s.frozenTaskSnapshot)
      ? [...(s.frozenTaskSnapshot as unknown as FrozenTaskSnapshotEntry[])].sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber))
      : [];

    const allocations = s.allocations.map((a) => ({
      id: a.id,
      personId: a.personId,
      personName: a.person.name,
      competencyLevel: a.person.competency?.level ?? null,
      allocationPct: a.allocationPct,
      jiraHours: a.jiraHours,
    }));

    return {
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      closedAt: s.closedAt,
      pv,
      ev,
      av,
      tasks,
      departedTasks,
      frozenTasks,
      allocations,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Sprints</h2>
          <p className="text-sm text-slate-500">
            0/100 rule: a committed task earns its full story points only once it&apos;s fully done. Open a sprint to
            import tasks from the backlog, update % complete, actual hours (e.g. read off Jira), and assignee. Close
            a sprint to freeze its PV/EV/AV permanently once it ends. New tasks are defined on the Tasks tab.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SprintPlaybookModal />
          <a
            href={`/api/projects/${params.projectId}/delivery/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddSprintModal projectId={params.projectId} suggestedName={`Sprint ${sprints.length + 1}`} />}
        </div>
      </div>

      <PageGuide
        id="delivery-sprints"
        title="How progress gets tracked here"
        points={[
          <><strong>0/100 rule:</strong> a task earns its story points only once % Complete reaches 100 — there&apos;s no partial credit for a task that&apos;s 60% done.</>,
          <><strong>Actual Hours</strong> shown here is scoped to this sprint (hours logged since the task joined it), not the task&apos;s lifetime total.</>,
          <>Closing a sprint freezes its PV/EV/AV permanently. If any committed task is still incomplete, you&apos;ll be asked to move it into another open sprint or accept it as spillover before the sprint closes.</>,
          <>Once closed, a sprint needs an Admin to reopen it — that&apos;s meant for fixing a mistake, not for routine spillover handling.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Sprints" value={String(sprints.length)} />
        <StatTile
          icon={<IconClock />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="Open Sprints"
          value={String(sprints.filter((s) => !s.closedAt).length)}
        />
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="Closed Sprints"
          value={String(sprints.filter((s) => s.closedAt).length)}
        />
        <StatTile icon={<IconClipboardList />} iconWrapClass="bg-amber-50 text-amber-600" label="Backlog Tasks" value={String(backlogTasks.length)} />
      </div>

      <div className="space-y-3">
        {sprintSummaries.length > 0 ? (
          sprintSummaries.map((s) => (
            <SprintSummaryRow
              key={s.id}
              projectId={params.projectId}
              sprint={s}
              roster={roster}
              backlogTasks={backlogTasks}
              allProjectTasks={allProjectTasks}
              otherOpenSprints={openSprints.filter((o) => o.id !== s.id)}
              canWrite={canWrite}
              isAdmin={isAdmin}
            />
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
