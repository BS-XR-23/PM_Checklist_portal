import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { DEVOPS_CATEGORIES } from "@/lib/seed-data";

export default async function DevOpsChecklistPage({ params }: { params: { projectId: string } }) {
  const items = await prisma.checklistItem.findMany({
    where: { projectId: params.projectId, type: "DEVOPS" },
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">DevOps Checklist</h2>
        <p className="text-sm text-slate-500">18 items across Infrastructure, CI/CD, Security, Reliability, and Release & Ops.</p>
      </div>
      <ChecklistTable
        projectId={params.projectId}
        checklistType="DEVOPS"
        items={items}
        stageOrder={DEVOPS_CATEGORIES}
        stageLabel="Category"
      />
    </div>
  );
}
