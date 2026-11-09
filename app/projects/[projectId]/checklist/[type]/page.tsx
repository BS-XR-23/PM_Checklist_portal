import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChecklistTable } from "@/components/checklist/checklist-table";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { CHECKLIST_TYPE_BY_ROUTE } from "@/lib/checklist-types";
import { checklistSubNavOptions } from "@/lib/checklist-nav";
import { loadChecklistItems } from "@/lib/checklist-items";
import { requireModuleAccess, getCurrentUser } from "@/lib/rbac";
import { canViewQms } from "@/lib/qms";

// Retired route segments — "engineering" and "qa" were two separate
// checklist types/tabs until they merged into "delivery-qa" (see
// lib/checklist-types.ts). Any existing bookmark/notification link to the
// old URLs lands here instead of a 404.
const RETIRED_TYPE_SEGMENTS: Record<string, string> = { engineering: "delivery-qa", qa: "delivery-qa" };

export default async function ChecklistPage({ params }: { params: { projectId: string; type: string } }) {
  const retired = RETIRED_TYPE_SEGMENTS[params.type];
  if (retired) redirect(`/projects/${params.projectId}/checklist/${retired}`);

  const active = CHECKLIST_TYPE_BY_ROUTE[params.type];
  if (!active) notFound();
  // Development Checklist only shows inside Delivery, not the general
  // Checklist tab — send anyone who lands here (bookmark, typed URL) to its
  // real home instead of rendering it under this tab's chrome.
  if (!active.inGeneralChecklistNav) redirect(`/projects/${params.projectId}/delivery/checklist`);

  const [access, user] = await Promise.all([requireModuleAccess(params.projectId, active.moduleName, "READ_LIMITED"), getCurrentUser()]);

  const [visibleItems, subNavOptions, people] = await Promise.all([
    loadChecklistItems(params.projectId, active.key, access),
    checklistSubNavOptions(params.projectId),
    access === "WRITE" || (user?.role === "TPM" && access === "READ_FULL") ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

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
            <>Set a <strong>Planned Date</strong> on each item — a late item gets a red &ldquo;N days late&rdquo; flag, and the <strong>Overdue</strong> tile shows just those. Marking it <strong>Completed</strong> fills today as the Actual Date if it&apos;s empty.</>,
            <>Marking an item <strong>Not Applicable</strong> removes it from the completion % entirely — it counts as out of scope, not as incomplete.</>,
            <>A <strong>Checkpoint</strong> label marks an internal step (e.g. DoR Approved) — no payment. Client milestones and payments live on <strong>Milestones &amp; Payments</strong>.</>,
            <>In Ongoing cadence, use <strong>Log</strong> each time an activity happens, with a link to the evidence.</>,
            ...(user && canViewQms(user.role)
              ? [<>An item with a <strong>QMS</strong> badge feeds the QMS Audit tab. It counts as done once it&apos;s Completed with an owner, actual date and link.</>]
              : []),
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
