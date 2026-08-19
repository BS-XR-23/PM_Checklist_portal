import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireUser } from "@/lib/rbac";
import { compareWbsNumbers } from "@/lib/format";
import { SubNav } from "@/components/ui/sub-nav";
import { StatCard } from "@/components/ui/stat-card";
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
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Sprints" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Tasks</h2>
        <p className="text-sm text-slate-500">
          The project-wide WBS — defined once here. Story Points is the estimate; the default assignee here is
          just a starting point, overridable once a task is committed and tracked. Commit a task to a sprint here,
          or import it into one directly from the Sprints tab, to track its progress there.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Pts">{totalPts.toFixed(1)}</StatCard>
        <StatCard label="Done Pts">{donePts.toFixed(1)}</StatCard>
        <StatCard label="Remaining Pts">{remainingPts.toFixed(1)}</StatCard>
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
      />
      {canWrite && <UploadWbsTasksForm projectId={params.projectId} />}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Completed ({doneTasks.length})</h3>
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
