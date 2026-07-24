import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { PM_STAGES } from "@/lib/seed-data";

export default async function PmChecklistPage({ params }: { params: { projectId: string } }) {
  const items = await prisma.checklistItem.findMany({
    where: { projectId: params.projectId, type: "PM" },
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">PM Checklist</h2>
        <p className="text-sm text-slate-500">51 items across 7 stages, aligned to the BS23 XR23 PM Process.</p>
      </div>
      <ChecklistTable
        projectId={params.projectId}
        checklistType="PM"
        items={items}
        stageOrder={PM_STAGES}
        stageLabel="Stage"
      />
    </div>
  );
}
