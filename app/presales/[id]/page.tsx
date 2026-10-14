import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { dealFlags } from "@/lib/presales-pipeline";
import { PresalesHero, PresalesDetails } from "./presales-overview";
import { PresalesNextSteps } from "./presales-next-steps";
import { PresalesDecisionLog } from "./presales-decision-log";
import { PresalesChecklistRow } from "./presales-checklist-row";
import { AddPresalesChecklistItemButton } from "./add-presales-checklist-item-button";

export const dynamic = "force-dynamic";

const VIEW_ROLES = ["ADMIN", "PM", "TPM", "PROGRAM_MANAGER"] as const;

export default async function PresalesDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!VIEW_ROLES.includes(user.role as (typeof VIEW_ROLES)[number])) redirect("/projects");

  const canWrite = user.role === "ADMIN" || user.role === "PM";
  const isAdmin = user.role === "ADMIN";

  const [presales, people] = await Promise.all([
    prisma.presalesProject.findUnique({
      where: { id: params.id },
      include: {
        wonProject: { select: { id: true, name: true } },
        dealOwnerPerson: { select: { id: true, name: true } },
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
  const flags = dealFlags({ ...presales, openActionCount: actionItems.filter((a) => a.status !== "Done").length });

  const checklistDone = checklistItems.filter((c) => c.status === "COMPLETED" || c.status === "NOT_APPLICABLE").length;
  const checklistPct = checklistItems.length ? Math.round((checklistDone / checklistItems.length) * 100) : 0;

  return (
    <AppShell user={user}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
        <Link href="/presales" className="text-sm text-slate-500 hover:text-slate-800">
          ← Presales pipeline
        </Link>
        <Link
          href={`/presales/${presales.id}/activity`}
          prefetch={false}
          title="Activity log"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:border-slate-300"
        >
          Activity
        </Link>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        <PresalesHero data={presales} flags={flags} canWrite={canWrite} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <PresalesNextSteps presalesProjectId={presales.id} items={actionItems} canWrite={canWrite} people={people} />
            <PresalesDecisionLog presalesProjectId={presales.id} items={decisions} canWrite={canWrite} />

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Presales checklist</h2>
                  {checklistItems.length > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-slate-600">
                      {checklistDone}/{checklistItems.length} done
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">The standard playbook for this deal. If won, these carry into the project&apos;s PM Checklist.</p>
                {checklistItems.length > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${checklistPct}%` }} />
                  </div>
                )}
              </header>
              <div className="space-y-3 p-4">
                {checklistItems.map((c) => (
                  <PresalesChecklistRow key={c.id} presalesProjectId={presales.id} item={c} canWrite={canWrite} isAdmin={isAdmin} people={people} />
                ))}
                {checklistItems.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No playbook steps on this deal yet.{" "}
                    {isAdmin ? (
                      <>
                        Set the standard steps once in{" "}
                        <Link href="/admin/checklist-template" className="font-medium text-blue-600 hover:underline">
                          Admin → Checklist Template
                        </Link>{" "}
                        and every new opportunity gets them.
                      </>
                    ) : canWrite ? (
                      "An Admin can define the standard steps; you can add your own below."
                    ) : (
                      "An Admin can define the standard steps."
                    )}
                  </p>
                )}
                {canWrite && <AddPresalesChecklistItemButton presalesProjectId={presales.id} />}
              </div>
            </section>
          </div>

          <div className="xl:col-span-2">
            <PresalesDetails data={presales} canWrite={canWrite} people={people} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
