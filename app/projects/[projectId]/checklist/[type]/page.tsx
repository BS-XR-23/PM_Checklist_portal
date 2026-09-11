import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_ROUTE } from "@/lib/checklist-types";
import { requireModuleAccess, getModuleAccess, getCurrentUser } from "@/lib/rbac";
import type { AccessLevel } from "@prisma/client";

export default async function ChecklistPage({ params }: { params: { projectId: string; type: string } }) {
  const active = CHECKLIST_TYPE_BY_ROUTE[params.type];
  if (!active) notFound();
  // Development Checklist only shows inside Delivery, not the general
  // Checklist tab — send anyone who lands here (bookmark, typed URL) to its
  // real home instead of rendering it under this tab's chrome.
  if (!active.inGeneralChecklistNav) redirect(`/projects/${params.projectId}/delivery/checklist`);

  const generalTypes = CHECKLIST_TYPES.filter((c) => c.inGeneralChecklistNav);
  const [access, otherAccess, user] = await Promise.all([
    requireModuleAccess(params.projectId, active.moduleName, "READ_LIMITED"),
    Promise.all(
      generalTypes.filter((c) => c.key !== active.key).map(
        async (c) => [c, await getModuleAccess(params.projectId, c.moduleName)] as [typeof c, AccessLevel]
      )
    ),
    getCurrentUser(),
  ]);

  const [items, otherCounts, people] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId: params.projectId, type: active.key },
      orderBy: { order: "asc" },
      include: { ownerPerson: { select: { id: true, name: true } } },
    }),
    Promise.all(
      otherAccess.map(async ([c, a]) =>
        a !== "NONE" ? [c, await prisma.checklistItem.count({ where: { projectId: params.projectId, type: c.key } })] : [c, 0]
      )
    ) as Promise<[(typeof CHECKLIST_TYPES)[number], number][]>,
    access === "WRITE" ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const withOwnerName = items.map((i) => ({ ...i, ownerPersonName: i.ownerPerson?.name ?? null }));
  const visibleItems = access === "READ_LIMITED" ? withOwnerName.map((i) => ({ ...i, notes: null })) : withOwnerName;

  const countByKey = new Map(otherCounts.map(([c, count]) => [c.key, count]));
  const accessByKey = new Map(otherAccess.map(([c, a]) => [c.key, a]));
  const subNavOptions = generalTypes.filter((c) => c.key === active.key || accessByKey.get(c.key) !== "NONE").map((c) => ({
    href: `/checklist/${c.routeSegment}`,
    label: c.label,
    count: c.key === active.key ? items.length : (countByKey.get(c.key) ?? 0),
  }));

  return (
    <div>
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{active.label}</h2>
        <p className="text-sm text-slate-500">{active.description}</p>
      </div>

      <div className="mb-4">
        <PageGuide
          id="checklist-general"
          title="How to fill this in"
          points={[
            <>Marking an item <strong>Not Applicable</strong> removes it from the completion % entirely — it counts as out of scope, not as incomplete.</>,
            <>Tagging an item with a <strong>Milestone Name</strong> is what creates a row on the project&apos;s Milestones &amp; Payments tab — that&apos;s the only way a payment milestone gets created, there&apos;s no separate &quot;add milestone&quot; step.</>,
            <>A read-limited viewer sees every item&apos;s Notes stripped out — that&apos;s deliberate, not missing data.</>,
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
