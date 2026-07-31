import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { PresalesOverview } from "./presales-overview";
import { PresalesChecklistRow } from "./presales-checklist-row";
import { AddPresalesChecklistItemButton } from "./add-presales-checklist-item-button";
import { PresalesDecisionRow } from "./presales-decision-row";
import { AddPresalesDecisionButton } from "./add-presales-decision-button";
import { PresalesActionItemRow } from "./presales-action-item-row";
import { AddPresalesActionItemButton } from "./add-presales-action-item-button";

export const dynamic = "force-dynamic";

const VIEW_ROLES = ["ADMIN", "PM", "TPM", "PROGRAM_MANAGER"] as const;

export default async function PresalesDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!VIEW_ROLES.includes(user.role as (typeof VIEW_ROLES)[number])) redirect("/projects");

  const canWrite = user.role === "ADMIN" || user.role === "PM";

  const [presales, people] = await Promise.all([
    prisma.presalesProject.findUnique({
      where: { id: params.id },
      include: {
        wonProject: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: "asc" }, include: { ownerPerson: { select: { id: true, name: true } } } },
        decisions: { orderBy: { order: "asc" }, include: { decidedByPerson: { select: { id: true, name: true } } } },
        actionItems: { orderBy: { order: "asc" }, include: { ownerPerson: { select: { id: true, name: true } } } },
      },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  if (!presales || presales.deletedAt) notFound();

  const checklistItems = presales.checklistItems.map((c) => ({ ...c, ownerPersonName: c.ownerPerson?.name ?? null }));
  const decisions = presales.decisions.map((d) => ({ ...d, decidedByPersonName: d.decidedByPerson?.name ?? null }));
  const actionItems = presales.actionItems.map((a) => ({ ...a, ownerPersonName: a.ownerPerson?.name ?? null }));

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <Link href="/presales" className="text-xs text-slate-400 hover:text-slate-600">← Presales</Link>
        <h1 className="text-lg font-semibold text-slate-900">{presales.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <PresalesOverview data={presales} canWrite={canWrite} />

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Presales Checklist</h2>
              <p className="text-sm text-slate-500">The standard playbook for this deal. If Won, these carry into the project's PM Checklist.</p>
            </div>
          </div>
          <div className="space-y-3">
            {checklistItems.map((c) => (
              <PresalesChecklistRow key={c.id} presalesProjectId={presales.id} item={c} canWrite={canWrite} isAdmin={user.role === "ADMIN"} people={people} />
            ))}
            {checklistItems.length === 0 && <p className="text-sm text-slate-400">No checklist items yet.</p>}
            {canWrite && <AddPresalesChecklistItemButton presalesProjectId={presales.id} />}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Decision Log</h2>
              <p className="text-sm text-slate-500">What's being decided, and why, before this becomes a real project.</p>
            </div>
            {canWrite && <AddPresalesDecisionButton presalesProjectId={presales.id} />}
          </div>
          <div className="space-y-3">
            {decisions.map((d) => (
              <PresalesDecisionRow key={d.id} presalesProjectId={presales.id} item={d} canWrite={canWrite} people={people} />
            ))}
            {decisions.length === 0 && <p className="text-sm text-slate-400">No decisions logged yet.</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Action Items</h2>
              <p className="text-sm text-slate-500">Follow-ups that fell out of a call — too easy to forget otherwise.</p>
            </div>
            {canWrite && <AddPresalesActionItemButton presalesProjectId={presales.id} />}
          </div>
          <div className="space-y-3">
            {actionItems.map((a) => (
              <PresalesActionItemRow key={a.id} presalesProjectId={presales.id} item={a} canWrite={canWrite} people={people} />
            ))}
            {actionItems.length === 0 && <p className="text-sm text-slate-400">No action items yet.</p>}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
