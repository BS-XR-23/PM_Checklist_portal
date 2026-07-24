"use client";

import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { updatePmPlanField } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export function ProjectDetailsFields({
  pmPlanId,
  projectId,
  preparedBy,
  planDate,
  version,
}: {
  pmPlanId: string;
  projectId: string;
  preparedBy: string;
  planDate: string | null;
  version: string;
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Prepared By</label>
        <InlineText value={preparedBy} onSave={(v) => updatePmPlanField(pmPlanId, projectId, "preparedBy", v)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
        <InlineDate value={planDate} onSave={(v) => updatePmPlanField(pmPlanId, projectId, "planDate", v ?? "")} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Version</label>
        <InlineText value={version} onSave={(v) => updatePmPlanField(pmPlanId, projectId, "version", v)} />
      </div>
    </div>
  );
}
