import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireUser } from "@/lib/rbac";
import { compareWbsNumbers } from "@/lib/format";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { IconClipboardList, IconFileText, IconCheckCircle, IconClock } from "@/components/layout/icons";
import { WbsTasksTable } from "../delivery-tasks-table";
import { UploadWbsTasksForm } from "../upload-wbs-tasks-form";
import type { AuditLogRow } from "@/components/rbac/audit-log-table";

export const dynamic = "force-dynamic";

export default async function DeliveryTasksPage({ params }: { params: { projectId: string } }) {
  const [access, user] = await Promise.all([
    requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED"),
    requireUser(),
  ]);
  const canWrite = access === "WRITE";
  // Per-task History is audit-trail data — same PM/TPM/Admin-only policy as
  // the project's own Activity page, regardless of a viewer's DELIVERY
  // access (a CLIENT could have DELIVERY read access without qualifying to
  // see who-changed-what internally).
  const canViewHistory = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";

  const [tasksRaw, engagements, sprints] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "asc" } }),
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: { include: { competency: true } } },
      orderBy: { person: { name: "asc" } },
    }),
    prisma.sprint.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "asc" } }),
  ]);

  // Default view order is by WBS#, not upload order — a natural sort so
  // "2.10" sorts after "2.9" rather than before "2.2". Tasks never numbered
  // (blank WBS#, e.g. from an import whose file had no recognized WBS
  // column) sort to the end rather than the top.
  const tasks = [...tasksRaw].sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber));

  const roster = Array.from(new Map(engagements.map((e) => [e.personId, e])).values()).map((e) => ({
    personId: e.person.id,
    personName: e.person.name,
    competencyLevel: e.person.competency?.level ?? null,
  }));

  const sprintOptions = sprints.map((s) => ({ id: s.id, name: s.name, closedAt: s.closedAt }));

  // One query for every task's history, grouped client-side by entityId —
  // avoids an on-demand fetch per row click, and keeps the read on the
  // server-rendering side (this page), consistent with how the rest of the
  // app reads data, instead of adding a new "read" server action.
  const taskHistory: Record<string, AuditLogRow[]> = {};
  if (canViewHistory && tasks.length > 0) {
    const logs = await prisma.auditLog.findMany({
      where: { projectId: params.projectId, entityType: "WbsTask", entityId: { in: tasks.map((t) => t.id) } },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    });
    for (const l of logs) {
      if (!l.entityId) continue;
      const row: AuditLogRow = {
        id: l.id,
        actorName: l.actor.name,
        actorRole: l.actorRole,
        action: l.action,
        entityType: l.entityType,
        summary: l.summary,
        isOverride: l.isOverride,
        createdAt: l.createdAt,
      };
      (taskHistory[l.entityId] ??= []).push(row);
    }
  }

  // Informational only, same as each row's Done/Remaining below — never
  // feeds PV/EV/AV, which stay governed by the 0/100 rule on the Sprints
  // tab. This is just a whole-backlog burn-down at a glance.
  const totalPts = tasks.reduce((sum, t) => sum + t.storyPoints, 0);
  const donePts = tasks.reduce((sum, t) => sum + t.storyPoints * t.pctComplete, 0);
  const remainingPts = totalPts - donePts;

  // Split into two tables so completed work stops competing for space with
  // what's still active, without losing it — "done" here matches the same
  // continuous pctComplete already used for the Done/Remaining columns
  // above (informational, not the strict 0/100 EV rule).
  const activeTasks = tasks.filter((t) => t.pctComplete < 1);
  const doneTasks = tasks.filter((t) => t.pctComplete >= 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Tasks</h2>
          <p className="text-sm text-slate-500">
            The project-wide WBS — defined once here. Story Points is the estimate; the default assignee here is
            just a starting point, overridable once a task is committed and tracked. Commit a task to a sprint here,
            or import it into one directly from the Sprints tab, to track its progress there.
          </p>
        </div>
        <a
          href={`/api/projects/${params.projectId}/delivery/tasks/export`}
          className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50 shrink-0"
        >
          Export .xlsx
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          icon={<IconFileText />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="Total Story Points"
          value={totalPts.toFixed(1)}
        />
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="Done Points"
          value={donePts.toFixed(1)}
          subtitle={totalPts ? `${((donePts / totalPts) * 100).toFixed(1)}%` : undefined}
        />
        <StatTile
          icon={<IconClock />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Remaining Points"
          value={remainingPts.toFixed(1)}
          subtitle={totalPts ? `${((remainingPts / totalPts) * 100).toFixed(1)}%` : undefined}
        />
        <StatTile icon={<IconClipboardList />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Tasks" value={String(tasks.length)} />
      </div>

      <WbsTasksTable
        projectId={params.projectId}
        tasks={activeTasks}
        duplicateCheckTasks={tasks}
        roster={roster}
        sprints={sprintOptions}
        canWrite={canWrite}
        emptyMessage="No active tasks — everything's either done or nothing's been added yet."
        taskHistory={canViewHistory ? taskHistory : undefined}
        uploadForm={canWrite ? <UploadWbsTasksForm projectId={params.projectId} /> : undefined}
      />

      <div>
        <SectionHeader
          icon={<IconCheckCircle />}
          iconWrapClass="bg-slate-100 text-slate-500"
          title={`Completed (${doneTasks.length})`}
        />
        <WbsTasksTable
          projectId={params.projectId}
          tasks={doneTasks}
          duplicateCheckTasks={tasks}
          roster={roster}
          sprints={sprintOptions}
          canWrite={canWrite}
          showAddRow={false}
          emptyMessage="No completed tasks yet."
          taskHistory={canViewHistory ? taskHistory : undefined}
        />
      </div>
    </div>
  );
}
