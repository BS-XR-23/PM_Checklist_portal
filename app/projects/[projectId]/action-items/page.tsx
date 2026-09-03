import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { AddActionItemButton } from "./add-action-item-button";
import { ActionItemRow } from "./action-item-row";

export default async function ActionItemsPage({ params }: { params: { projectId: string } }) {
  const [access, decisionLogAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "ACTION_ITEMS", "READ_LIMITED"),
    getModuleAccess(params.projectId, "DECISION_LOG"),
  ]);
  const canWrite = access === "WRITE";
  const subNavOptions = [
    ...(decisionLogAccess !== "NONE" ? [{ href: "/decisions", label: "Decision Log" }] : []),
    { href: "/action-items", label: "Action Items" },
  ];

  const [rawItems, people] = await Promise.all([
    prisma.actionItem.findMany({
      where: { projectId: params.projectId },
      orderBy: { order: "asc" },
      include: { ownerPerson: { select: { id: true, name: true } } },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const items = rawItems.map((i) => ({ ...i, ownerPersonName: i.ownerPerson?.name ?? null }));

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Action Items</h2>
          <p className="text-sm text-slate-500">Small follow-ups with an owner and a due date — too lightweight for the Checklist, still too easy to forget.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/projects/${params.projectId}/action-items/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddActionItemButton projectId={params.projectId} />}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((i) => (
          <ActionItemRow key={i.id} projectId={params.projectId} item={i} canWrite={canWrite} people={people} />
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No action items yet.</p>}
      </div>
    </div>
  );
}
