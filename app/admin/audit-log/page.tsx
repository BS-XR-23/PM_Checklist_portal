import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AuditLogTable } from "@/components/rbac/audit-log-table";
import { AppShell } from "@/components/layout/app-shell";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatTile } from "@/components/ui/stat-tile";
import { IconDownload, IconClipboardList, IconAlertTriangle, IconAlertCircle, IconUsers, IconFilter, IconX } from "@/components/layout/icons";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** end-of-day, local-date-string boundary so a "to" filter includes that whole day */
function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function GlobalAuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; projectId?: string; actorId?: string; action?: string; from?: string; to?: string };
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/projects");

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const projectId = searchParams.projectId || undefined;
  const actorId = searchParams.actorId || undefined;
  const action = searchParams.action || undefined;
  const from = searchParams.from || undefined;
  const to = searchParams.to || undefined;
  const hasFilters = !!(projectId || actorId || action || from || to);

  const where: Prisma.AuditLogWhereInput = {
    ...(projectId ? { projectId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: endOfDay(to) } : {}),
          },
        }
      : {}),
  };

  const [logs, totalCount, overrideCount, deleteCount, distinctActors, projects, actors, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: true, project: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...where, isOverride: true } }),
    prisma.auditLog.count({ where: { ...where, action: "delete" } }),
    // KPI tiles reflect the current filtered view, not the whole table — same
    // "contextual to what you're looking at" convention as the Portfolio KPIs.
    prisma.auditLog.findMany({ where, distinct: ["actorId"], select: { actorId: true } }),
    // Every project ever, not just active ones — a permanently deleted
    // project's audit trail (project-less rows) still needs its old,
    // now-gone name filterable... but it can't be, since the row is gone.
    // This lists projects that still exist to filter by; permanently
    // deleted projects' history is still visible unfiltered, just not
    // filterable by name here.
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Derived from real data instead of a hand-maintained list, so a new
    // action string introduced anywhere in the app becomes filterable
    // automatically instead of silently falling outside every filter option.
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const actionOptions = distinctActions.map((a) => a.action);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (actorId) params.set("actorId", actorId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(p));
    return `/admin/audit-log?${params.toString()}`;
  }

  const exportParams = new URLSearchParams();
  if (projectId) exportParams.set("projectId", projectId);
  if (actorId) exportParams.set("actorId", actorId);
  if (action) exportParams.set("action", action);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Audit Log</h1>
          <p className="text-sm text-slate-500 max-w-2xl">Every write across every project, plus user/role and project-creation events.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <RefreshButton />
          <a
            href={`/api/audit-log/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <IconDownload className="h-4 w-4" />
            Export
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile
            icon={<IconClipboardList />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="Total Events"
            value={String(totalCount)}
            accentColor="#2563EB"
            subtitle={hasFilters ? "Matching current filters" : "All time"}
          />
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Overrides"
            value={String(overrideCount)}
            accentColor="#92400E"
          />
          <StatTile
            icon={<IconAlertCircle />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Deletions"
            value={String(deleteCount)}
            accentColor="#9F1239"
          />
          <StatTile
            icon={<IconUsers />}
            iconWrapClass="bg-violet-50 text-violet-600"
            label="Active Actors"
            value={String(distinctActors.length)}
            accentColor="#6D28D9"
          />
        </div>

        <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
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
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input type="date" name="from" defaultValue={from ?? ""} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input type="date" name="to" defaultValue={to ?? ""} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filter
          </button>
          {hasFilters && (
            <Link href="/admin/audit-log" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 pb-2">
              <IconX className="h-3.5 w-3.5" />
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
            diff: l.diff,
          }))}
        />

        {totalCount > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} of {totalPages} <span className="text-slate-400">({totalCount} total)</span>
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-md border border-slate-100 px-3 py-1.5 font-medium text-slate-300">← Previous</span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                  Next →
                </Link>
              ) : (
                <span className="rounded-md border border-slate-100 px-3 py-1.5 font-medium text-slate-300">Next →</span>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
