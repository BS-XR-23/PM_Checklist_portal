import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AuditLogTable } from "@/components/rbac/audit-log-table";
import { AppShell } from "@/components/layout/app-shell";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
// Every literal string ever passed as `action` to writeAudit() across the codebase.
const ACTIONS = ["create", "update", "delete", "override", "role_change"] as const;

export default async function GlobalAuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; projectId?: string; actorId?: string; action?: string };
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/projects");

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const projectId = searchParams.projectId || undefined;
  const actorId = searchParams.actorId || undefined;
  const action = searchParams.action || undefined;
  const hasFilters = !!(projectId || actorId || action);

  const where: Prisma.AuditLogWhereInput = {
    ...(projectId ? { projectId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
  };

  const [logs, totalCount, projects, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: true, project: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    // Every project ever, not just active ones — a permanently deleted
    // project's audit trail (project-less rows) still needs its old,
    // now-gone name filterable... but it can't be, since the row is gone.
    // This lists projects that still exist to filter by; permanently
    // deleted projects' history is still visible unfiltered, just not
    // filterable by name here.
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (actorId) params.set("actorId", actorId);
    if (action) params.set("action", action);
    params.set("page", String(p));
    return `/admin/audit-log?${params.toString()}`;
  }

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Global Audit Log</h1>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">
          Every write across every project, plus user/role and project-creation events. {totalCount} total.
        </p>

        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
            <select name="projectId" defaultValue={projectId ?? ""} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actor</label>
            <select name="actorId" defaultValue={actorId ?? ""} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="">All Actors</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
            <select name="action" defaultValue={action ?? ""} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="">All Actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">
            Filter
          </button>
          {hasFilters && (
            <Link href="/admin/audit-log" className="text-sm text-slate-500 hover:text-slate-700 pb-2">
              Clear filters
            </Link>
          )}
        </form>

        <AuditLogTable
          showProject
          rows={logs.map((l) => ({
            id: l.id,
            actorName: l.actor.name,
            actorRole: l.actorRole,
            action: l.action,
            entityType: l.entityType,
            summary: l.summary,
            isOverride: l.isOverride,
            createdAt: l.createdAt,
            projectName: l.project?.name,
          }))}
        />

        {totalCount > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-4">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="font-medium text-slate-700 hover:text-slate-900">
                  ← Previous
                </Link>
              ) : (
                <span className="text-slate-300">← Previous</span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="font-medium text-slate-700 hover:text-slate-900">
                  Next →
                </Link>
              ) : (
                <span className="text-slate-300">Next →</span>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
