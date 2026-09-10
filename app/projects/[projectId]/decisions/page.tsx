import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { AddDecisionButton } from "./add-decision-button";
import { DecisionRow } from "./decision-row";

export default async function DecisionLogPage({ params }: { params: { projectId: string } }) {
  const [access, actionItemsAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "DECISION_LOG", "READ_LIMITED"),
    getModuleAccess(params.projectId, "ACTION_ITEMS"),
  ]);
  const canWrite = access === "WRITE";
  const subNavOptions = [
    { href: "/decisions", label: "Decision Log" },
    ...(actionItemsAccess !== "NONE" ? [{ href: "/action-items", label: "Action Items" }] : []),
  ];

  const rawItems = await prisma.decisionLogItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
    include: { decidedByPerson: { select: { id: true, name: true } } },
  });
  const items = rawItems.map((i) => ({ ...i, decidedByPersonName: i.decidedByPerson?.name ?? null }));

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Decision Log</h2>
          <p className="text-sm text-slate-500">What was decided, when, and why — a permanent record so it doesn&apos;t get re-litigated later.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/projects/${params.projectId}/decisions/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddDecisionButton projectId={params.projectId} />}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((i) => (
          <DecisionRow key={i.id} projectId={params.projectId} item={i} canWrite={canWrite} />
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No decisions logged yet.</p>}
      </div>
    </div>
  );
}
