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

  const [rawItems, people] = await Promise.all([
    prisma.decisionLogItem.findMany({
      where: { projectId: params.projectId },
      orderBy: { order: "asc" },
      include: { decidedByPerson: { select: { id: true, name: true } } },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const items = rawItems.map((i) => ({ ...i, decidedByPersonName: i.decidedByPerson?.name ?? null }));

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Decision Log</h2>
          <p className="text-sm text-slate-500">What was decided, when, and why — a permanent record so it doesn&apos;t get re-litigated later.</p>
        </div>
        {canWrite && <AddDecisionButton projectId={params.projectId} />}
      </div>

      <div className="space-y-3">
        {items.map((i) => (
          <DecisionRow key={i.id} projectId={params.projectId} item={i} canWrite={canWrite} people={people} />
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No decisions logged yet.</p>}
      </div>
    </div>
  );
}
