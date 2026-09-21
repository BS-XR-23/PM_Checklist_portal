import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { AuditLogTable } from "@/components/rbac/audit-log-table";

export const dynamic = "force-dynamic";

// Same view roles as the rest of Presales (app/presales/page.tsx,
// app/presales/[id]/page.tsx) — PROGRAM_MANAGER already has read access to
// everything presales-related, unlike the stricter Project activity log.
const VIEW_ROLES = ["ADMIN", "PM", "TPM", "PROGRAM_MANAGER"] as const;

export default async function PresalesActivityPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!VIEW_ROLES.includes(user.role as (typeof VIEW_ROLES)[number])) redirect("/projects");

  const presales = await prisma.presalesProject.findUnique({
    where: { id: params.id },
    include: {
      decisions: { select: { id: true } },
      actionItems: { select: { id: true } },
      checklistItems: { select: { id: true } },
    },
  });
  if (!presales || presales.deletedAt) notFound();

  // Presales audit rows always have projectId: null (writeAudit() omits it
  // throughout app/presales/actions.ts and the [id]/*-actions.ts files,
  // since a PresalesProject isn't a real Project) — filter by entityType/
  // entityId instead. A decision/action-item/checklist row that's since
  // been deleted won't have its id here anymore, so its audit history
  // drops out of the feed once the row itself is gone — acceptable for a
  // recent-activity view, not a permanent record.
  const childIds = [...presales.decisions, ...presales.actionItems, ...presales.checklistItems].map((x) => x.id);
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "PresalesProject", entityId: presales.id },
        { entityType: { in: ["PresalesDecisionItem", "PresalesActionItem", "PresalesChecklistItem"] }, entityId: { in: childIds } },
      ],
    },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <Link href={`/presales/${presales.id}`} className="text-xs text-slate-400 hover:text-slate-600">← {presales.name}</Link>
        <h1 className="text-lg font-semibold text-slate-900">Activity</h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">
          Every write to this opportunity — decisions, action items, checklist edits, and stage/owner changes — who made it, and when.
        </p>
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
      </main>
    </AppShell>
  );
}
