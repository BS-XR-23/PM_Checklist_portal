"use client";

import { useState, useTransition } from "react";
import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { updateEngagement, removeEngagement, setEngagementMonthIntensity } from "./resourcing-actions";

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
  intensityPct: number; // resolved for the currently-viewed month
  inBounds: boolean; // does the viewed month fall within Start/End?
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null;
  totalActivePct: number;
  isOverloaded: boolean;
  overlaps: OverlapInfo[];
};

function MonthIntensityInput({
  engagementId,
  projectId,
  month,
  value,
}: {
  engagementId: string;
  projectId: string;
  month: string;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = draft === "" ? 0 : Number(draft);
            if (parsed === value) return;
            setError(null);
            startTransition(async () => {
              try {
                await setEngagementMonthIntensity(engagementId, projectId, month, parsed);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update intensity.");
                setDraft(String(value));
              }
            });
          }}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        />
        <span className="text-xs text-slate-400">%</span>
      </div>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

export function EngagementRow({
  projectId,
  month,
  engagement,
  canEdit,
}: {
  projectId: string;
  month: string;
  engagement: EngagementRowData;
  canEdit: boolean;
}) {
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
      <td className="px-3 py-2 text-slate-600">
        {!engagement.inBounds ? (
          <span className="text-slate-300" title="This month falls outside this engagement's Start/End range">
            —
          </span>
        ) : canEdit ? (
          <MonthIntensityInput engagementId={engagement.id} projectId={projectId} month={month} value={engagement.intensityPct} />
        ) : (
          `${engagement.intensityPct}%`
        )}
      </td>
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
