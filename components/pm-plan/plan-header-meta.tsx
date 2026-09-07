"use client";

import { useState } from "react";
import { ProjectDetailsFields } from "./project-details-fields";
import { IconPencil, IconCalendar, IconClock, IconUser } from "@/components/layout/icons";
import { avatarColorFromString } from "@/lib/colors";
import { formatDate, formatDateTime, initials } from "@/lib/format";

export function PlanHeaderMeta({
  pmPlanId,
  projectId,
  preparedBy,
  planDate,
  version,
  updatedAt,
  canWrite,
}: {
  pmPlanId: string;
  projectId: string;
  preparedBy: string | null;
  planDate: string | null; // yyyy-mm-dd, for the editable date input
  version: string;
  updatedAt: Date;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <ProjectDetailsFields pmPlanId={pmPlanId} projectId={projectId} preparedBy={preparedBy ?? ""} planDate={planDate} version={version} />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-6">
      <div>
        <p className="text-xs text-slate-500 mb-1">Prepared By</p>
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(preparedBy || "?") }}
          >
            {preparedBy ? initials(preparedBy) : <IconUser className="h-3.5 w-3.5" />}
          </span>
          <span className="text-sm font-medium text-slate-800">{preparedBy || "—"}</span>
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">Date</p>
        <div className="flex items-center gap-1.5 text-sm text-slate-800">
          <IconCalendar className="h-3.5 w-3.5 text-slate-400" />
          {formatDate(planDate)}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">Version</p>
        <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold px-2.5 py-0.5">{version}</span>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">Last Updated</p>
        <div className="flex items-center gap-1.5 text-sm text-slate-800">
          <IconClock className="h-3.5 w-3.5 text-slate-400" />
          {formatDateTime(updatedAt)}
        </div>
      </div>
      {canWrite && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit plan details"
          className="mt-4 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <IconPencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
