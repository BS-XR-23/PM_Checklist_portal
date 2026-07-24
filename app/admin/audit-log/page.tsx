import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AuditLogTable } from "@/components/rbac/audit-log-table";
import { AdminHeader } from "../admin-header";

export const dynamic = "force-dynamic";

export default async function GlobalAuditLogPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/projects");

  const logs = await prisma.auditLog.findMany({
    include: { actor: true, project: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader title="Global Audit Log" active="audit-log" />
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">Every write across every project, plus user/role and project-creation events. Most recent 300.</p>
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
      </main>
    </div>
  );
}
