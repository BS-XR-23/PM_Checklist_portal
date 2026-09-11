import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { PageGuide } from "@/components/ui/page-guide";
import { CHECKLIST_TYPE_BY_KEY } from "@/lib/checklist-types";
import { requireModuleAccess, getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Development Checklist — a quality/governance gate (readiness, execution,
// quality gate, completion), NOT a task tracker; those belong on Tasks/
// Sprints. Reuses the general checklist system's ChecklistItem/
// ChecklistTable infrastructure (type "DEV"), but is reached only from
// here inside Delivery — deliberately excluded from the main Checklist
// tab's rotation (see inGeneralChecklistNav in lib/checklist-types.ts).
export default async function DeliveryChecklistPage({ params }: { params: { projectId: string } }) {
  const active = CHECKLIST_TYPE_BY_KEY.DEV;
  const [access, user] = await Promise.all([
    requireModuleAccess(params.projectId, active.moduleName, "READ_LIMITED"),
    getCurrentUser(),
  ]);

  const [items, people] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId: params.projectId, type: active.key },
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
        <h2 className="text-base font-semibold text-slate-900">{active.label}</h2>
        <p className="text-sm text-slate-500">{active.description}</p>
      </div>

      <div className="mb-4">
        <PageGuide
          id="delivery-checklist"
          title="How to use this checklist"
          points={[
            <>This is a quality/governance gate, not a task tracker — day-to-day progress belongs on Tasks and Sprints.</>,
            <>Items are grouped by stage in the order they should actually happen — readiness before execution, execution before the quality gate, and so on.</>,
            <>Only check an item off once its stage&apos;s criteria are genuinely met, not in anticipation of them being met.</>,
          ]}
        />
      </div>

      <ChecklistTable
        projectId={params.projectId}
        checklistType={active.key}
        items={visibleItems}
        stageOrder={active.stageOrder}
        stageLabel={active.stageLabel}
        access={access}
        viewerRole={user!.role}
        people={people}
      />
    </div>
  );
}
