"use client";

import { useTransition } from "react";
import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { updateEngagement, removeEngagement } from "./resourcing-actions";

export type OverlapInfo = {
  otherProjectName: string;
  otherRole: string;
  otherIntensityPct: number;
  start: string | null;
  end: string | null;
};

export type EngagementRowData = {
  id: string;
  personName: string;
  personTitle: string | null;
  roleOnProject: string;
  intensityPct: number;
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null;
  totalActivePct: number;
  isOverloaded: boolean;
  overlaps: OverlapInfo[];
};

export function EngagementRow({ projectId, engagement, canEdit }: { projectId: string; engagement: EngagementRowData; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        <p className="text-slate-800 font-medium">{engagement.personName}</p>
        {engagement.personTitle && <p className="text-xs text-slate-500">{engagement.personTitle}</p>}
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <InlineText value={engagement.roleOnProject} onSave={(v) => updateEngagement(engagement.id, projectId, { roleOnProject: v })} />
        ) : (
          <span className="text-slate-600">{engagement.roleOnProject}</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-600">{engagement.intensityPct}%</td>
      <td className="px-3 py-2">
        {canEdit ? (
          <InlineDate value={engagement.startDate} onSave={(v) => updateEngagement(engagement.id, projectId, { startDate: v })} />
        ) : (
          <span className="text-slate-600">{engagement.startDate ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <InlineDate value={engagement.endDate} onSave={(v) => updateEngagement(engagement.id, projectId, { endDate: v })} />
        ) : (
          <span className="text-slate-600">{engagement.endDate ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 space-y-1">
        {engagement.isOverloaded && (
          <span className="block w-fit rounded-full bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5">
            Overloaded — {engagement.totalActivePct}% total across active engagements
          </span>
        )}
        {engagement.overlaps.map((o, i) => (
          <span key={i} className="block w-fit rounded-full bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5">
            Also {o.otherRole} on {o.otherProjectName} ({o.otherIntensityPct}%){o.start || o.end ? ` — ${o.start ?? "…"} to ${o.end ?? "…"}` : ""}
          </span>
        ))}
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <button
            onClick={() => startTransition(() => removeEngagement(engagement.id, projectId))}
            disabled={pending}
            title="Remove from project"
            className="text-slate-300 hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
