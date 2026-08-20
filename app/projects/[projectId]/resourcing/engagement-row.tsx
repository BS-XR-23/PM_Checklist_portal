"use client";

import { useState, useTransition } from "react";
import { InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { INTENSITY_BAND_COLORS, intensityBand, avatarColorFromString } from "@/lib/colors";
import { initials } from "@/lib/format";
import { IconHeart, IconGauge, IconAlertCircle, IconClock, IconUserPlus, IconAlertTriangle } from "@/components/layout/icons";
import { updateEngagement, removeEngagement, setEngagementMonthIntensity } from "./resourcing-actions";

// Distinct from HIGH_INTENSITY_THRESHOLD_PCT (which bands a single
// engagement's own intensity) — this bands a person's TOTAL utilization
// across every active engagement, so it needs its own cutoffs. Matches
// OVERLOAD_THRESHOLD_PCT (100) at the top end, where isOverloaded already
// flips.
const SIGNAL_HIGH_UTIL_PCT = 70;

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
  endingSoon: boolean;
  newToProject: boolean;
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

function UtilizationSignal({ totalActivePct }: { totalActivePct: number }) {
  if (totalActivePct > 100) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600" title={`Over Utilized — ${totalActivePct}% total across active engagements`}>
        <IconAlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (totalActivePct >= SIGNAL_HIGH_UTIL_PCT) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600" title={`High Utilization — ${totalActivePct}% total across active engagements`}>
        <IconGauge className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" title={`Healthy — ${totalActivePct}% total across active engagements`}>
      <IconHeart className="h-3.5 w-3.5" />
    </span>
  );
}

export function EngagementRow({
  projectId,
  month,
  engagement,
  canEdit,
  roleOptions,
}: {
  projectId: string;
  month: string;
  engagement: EngagementRowData;
  canEdit: boolean;
  roleOptions: string[];
}) {
  // The current value might be a legacy freeform role that predates (or
  // just isn't in) the registry's title list — always offer it as an
  // option too, or the select would silently swap it for the first option.
  const roleSelectOptions = roleOptions.includes(engagement.roleOnProject) ? roleOptions : [engagement.roleOnProject, ...roleOptions];
  const band = intensityBand(engagement.intensityPct);

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(engagement.personName) }}
          >
            {initials(engagement.personName)}
          </span>
          <div>
            <p className="text-slate-800 font-medium">{engagement.personName}</p>
            {engagement.personTitle && <p className="text-xs text-slate-500">{engagement.personTitle}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <InlineSelect
            value={engagement.roleOnProject}
            options={roleSelectOptions}
            onSave={(v) => updateEngagement(engagement.id, projectId, { roleOnProject: v })}
          />
        ) : (
          <span className="text-slate-600">{engagement.roleOnProject}</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-600">
        {!engagement.inBounds ? (
          <span className="text-slate-300" title="This month falls outside this engagement's Start/End range">
            —
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {canEdit ? (
              <MonthIntensityInput engagementId={engagement.id} projectId={projectId} month={month} value={engagement.intensityPct} />
            ) : (
              <span className="w-10 shrink-0">{engagement.intensityPct}%</span>
            )}
            <span className="h-1.5 w-16 shrink-0 rounded-full bg-slate-100 overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.min(engagement.intensityPct, 100)}%`, backgroundColor: INTENSITY_BAND_COLORS[band].text }}
              />
            </span>
          </div>
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
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <UtilizationSignal totalActivePct={engagement.totalActivePct} />
          {engagement.overlaps.length > 0 && (
            <span
              className="relative flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600"
              title={engagement.overlaps
                .map((o) => `Also ${o.otherRole} on ${o.otherProjectName} (${o.otherIntensityPct}%)${o.start || o.end ? ` — ${o.start ?? "…"} to ${o.end ?? "…"}` : ""}`)
                .join("\n")}
            >
              <IconAlertTriangle className="h-3.5 w-3.5" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white">
                {engagement.overlaps.length}
              </span>
            </span>
          )}
          {engagement.endingSoon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600" title="Ending Soon — ends in the next 7 days">
              <IconClock className="h-3.5 w-3.5" />
            </span>
          )}
          {engagement.newToProject && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600" title="New to Project — assigned this month">
              <IconUserPlus className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <RowActionsMenu
            actions={[
              {
                label: "Remove from project",
                pendingLabel: "Removing...",
                danger: true,
                onClick: () => removeEngagement(engagement.id, projectId),
              },
            ]}
          />
        </td>
      )}
    </tr>
  );
}
