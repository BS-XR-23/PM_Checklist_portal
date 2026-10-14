import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { AuditLogTable } from "@/components/rbac/audit-log-table";

export default async function ActivityPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);

  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PM") {
    // 404 like every other RBAC denial (existence isn't revealed) — a throw
    // here surfaced as a 500 for Guest/Management.
    notFound();
  }

  const logs = await prisma.auditLog.findMany({
    where: { projectId: params.projectId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Activity</h2>
        <p className="text-sm text-slate-500">
          Every write to this project, who made it, and when. TPM overrides are tagged distinctly — never blended in
          as if the PM made the change.
        </p>
      </div>
      <AuditLogTable
        rows={logs.map((l) => ({
          id: l.id,
          actorName: l.actor.name,
          actorRole: l.actorRole,
          action: l.action,
          entityType: l.entityType,
          summary: l.summary,
          isOverride: l.isOverride,
          createdAt: l.createdAt,
          diff: l.diff,
        }))}
      />
    </div>
  );
}
