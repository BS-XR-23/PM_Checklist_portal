import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { DEVOPS_CATEGORIES } from "@/lib/seed-data";
import { requireModuleAccess, getCurrentUser } from "@/lib/rbac";

export default async function DevOpsChecklistPage({ params }: { params: { projectId: string } }) {
  const [access, user] = await Promise.all([
    requireModuleAccess(params.projectId, "DEVOPS_CHECKLIST", "READ_LIMITED"),
    getCurrentUser(),
  ]);

  const [items, people] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId: params.projectId, type: "DEVOPS" },
      orderBy: { order: "asc" },
      include: { ownerPerson: { select: { id: true, name: true } } },
    }),
    access === "WRITE" ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const withOwnerName = items.map((i) => ({ ...i, ownerPersonName: i.ownerPerson?.name ?? null }));
  const visibleItems = access === "READ_LIMITED" ? withOwnerName.map((i) => ({ ...i, notes: null })) : withOwnerName;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">DevOps Checklist</h2>
        <p className="text-sm text-slate-500">18 items across Infrastructure, CI/CD, Security, Reliability, and Release & Ops.</p>
      </div>
      <ChecklistTable
        projectId={params.projectId}
        checklistType="DEVOPS"
        items={visibleItems}
        stageOrder={DEVOPS_CATEGORIES}
        stageLabel="Category"
        access={access}
        viewerRole={user!.role}
        people={people}
      />
    </div>
  );
}
