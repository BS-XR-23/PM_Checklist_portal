import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { SubNav } from "@/components/ui/sub-nav";
import { PM_STAGES } from "@/lib/seed-data";
import { requireModuleAccess, getModuleAccess, getCurrentUser } from "@/lib/rbac";

export default async function PmChecklistPage({ params }: { params: { projectId: string } }) {
  const [access, devopsAccess, user] = await Promise.all([
    requireModuleAccess(params.projectId, "PM_CHECKLIST", "READ_LIMITED"),
    getModuleAccess(params.projectId, "DEVOPS_CHECKLIST"),
    getCurrentUser(),
  ]);

  const [items, devopsItemCount, people] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId: params.projectId, type: "PM" },
      orderBy: { order: "asc" },
      include: { ownerPerson: { select: { id: true, name: true } } },
    }),
    devopsAccess !== "NONE" ? prisma.checklistItem.count({ where: { projectId: params.projectId, type: "DEVOPS" } }) : Promise.resolve(0),
    access === "WRITE" ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const withOwnerName = items.map((i) => ({ ...i, ownerPersonName: i.ownerPerson?.name ?? null }));
  const visibleItems = access === "READ_LIMITED" ? withOwnerName.map((i) => ({ ...i, notes: null })) : withOwnerName;

  const subNavOptions = [
    { href: "/pm-checklist", label: "PM Checklist", count: items.length },
    ...(devopsAccess !== "NONE" ? [{ href: "/devops-checklist", label: "DevOps Checklist", count: devopsItemCount }] : []),
  ];

  return (
    <div>
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">PM Checklist</h2>
        <p className="text-sm text-slate-500">Aligned to the BS23 XR23 PM Process.</p>
      </div>
      <ChecklistTable
        projectId={params.projectId}
        checklistType="PM"
        items={visibleItems}
        stageOrder={PM_STAGES}
        stageLabel="Stage"
        access={access}
        viewerRole={user!.role}
        people={people}
      />
    </div>
  );
}
