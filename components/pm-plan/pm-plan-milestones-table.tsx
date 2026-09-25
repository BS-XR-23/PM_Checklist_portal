"use client";

import { useTransition } from "react";
import { InlineText, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { STATUS_COLORS } from "@/lib/colors";
import { ITEM_STATUSES } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import { createMilestone, updateMilestone, deleteMilestone } from "@/app/projects/[projectId]/delivery/milestones/milestone-actions";

// Reuses the Delivery tab's own Milestone rows/actions (not a PMPlan-owned
// copy) so a milestone added or deleted here is the same real row Delivery
// tracks for EV/AV — no second, driftable copy of the schedule.
export type PmPlanMilestoneRowData = {
  id: string;
  name: string;
  plannedDate: Date | string | null;
  ownerPersonId: string | null;
  acceptanceCriteria: string | null;
  status: string;
};

export function PmPlanMilestonesTable({
  projectId,
  rows,
  people,
}: {
  projectId: string;
  rows: PmPlanMilestoneRowData[];
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium">Milestone</th>
            <th className="px-3 py-2 font-medium">Baseline Date</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Exit Criteria</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-1.5">
                <InlineText value={r.name} onSave={(v) => updateMilestone(r.id, projectId, { name: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineDate value={toDateInputValue(r.plannedDate)} onSave={(v) => updateMilestone(r.id, projectId, { plannedDate: v })} />
              </td>
              <td className="px-3 py-1.5">
                <PersonPicker personId={r.ownerPersonId} legacyText={null} people={people} onSave={(personId) => updateMilestone(r.id, projectId, { ownerPersonId: personId })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineText value={r.acceptanceCriteria ?? ""} onSave={(v) => updateMilestone(r.id, projectId, { acceptanceCriteria: v })} />
              </td>
              <td className="px-3 py-1.5">
                <InlineSelect
                  value={r.status}
                  options={ITEM_STATUSES}
                  renderOption={(s) => STATUS_COLORS[s as keyof typeof STATUS_COLORS]?.label ?? s}
                  onSave={(v) => updateMilestone(r.id, projectId, { status: v })}
                />
              </td>
              <td className="px-3 py-1.5">
                <button
                  onClick={() => startTransition(() => deleteMilestone(r.id, projectId))}
                  disabled={pending}
                  className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() =>
          startTransition(async () => {
            await createMilestone(projectId, { name: "New milestone", type: "CUSTOM" });
          })
        }
        disabled={pending}
        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        + Add milestone
      </button>
    </div>
  );
}
