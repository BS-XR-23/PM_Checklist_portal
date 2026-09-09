"use client";

import { InlinePercent, InlineSelect, InlineText, InlineDate } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { IconCalendar } from "@/components/layout/icons";
import { STATUS_COLORS } from "@/lib/colors";
import { ITEM_STATUSES, MILESTONE_TYPES, MILESTONE_TYPE_LABELS, type ItemStatus } from "@/lib/constants";
import { formatDate, formatPct } from "@/lib/format";
import { updateMilestone, deleteMilestone } from "./milestone-actions";
import type { MilestoneType } from "@prisma/client";

export type MilestoneTableRow = {
  id: string;
  name: string;
  type: MilestoneType;
  description: string | null;
  status: ItemStatus;
  pctComplete: number;
  plannedDate: Date | null;
  forecastDate: Date | null;
  actualDate: Date | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  acceptanceCriteria: string | null;
};

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function MilestonesTable({
  projectId,
  canWrite,
  people,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  people: { id: string; name: string }[];
  rows: MilestoneTableRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
        No delivery milestones yet — add one to mark a major delivery checkpoint (MVP Complete, UAT Ready, ...).
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 w-10">#</th>
              <th className="px-3 py-2.5 min-w-[220px]">Milestone</th>
              <th className="px-3 py-2.5 w-32">Type</th>
              <th className="px-3 py-2.5 w-40">Status</th>
              <th className="px-3 py-2.5 w-24">% Complete</th>
              <th className="px-3 py-2.5 w-32">Owner</th>
              <th className="px-3 py-2.5 w-36">Planned</th>
              <th className="px-3 py-2.5 w-36">Forecast</th>
              <th className="px-3 py-2.5 w-36">Actual</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const statusColor = STATUS_COLORS[m.status];
              const variance =
                m.plannedDate && m.forecastDate
                  ? Math.round((m.forecastDate.getTime() - m.plannedDate.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                  <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineText value={m.name} onSave={(v) => updateMilestone(m.id, projectId, { name: v })} />
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={m.type}
                        options={MILESTONE_TYPES}
                        renderOption={(t) => MILESTONE_TYPE_LABELS[t]}
                        onSave={(v) => updateMilestone(m.id, projectId, { type: v as MilestoneType })}
                      />
                    ) : (
                      <span className="text-sm text-slate-700">{MILESTONE_TYPE_LABELS[m.type]}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={m.status}
                        options={ITEM_STATUSES}
                        renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        onSave={(v) => updateMilestone(m.id, projectId, { status: v })}
                      />
                    ) : (
                      <StatusBadge status={m.status} />
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlinePercent value={m.pctComplete} onSave={(v) => updateMilestone(m.id, projectId, { pctComplete: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{formatPct(m.pctComplete)}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <PersonPicker
                        personId={m.ownerPersonId}
                        legacyText={null}
                        people={people}
                        onSave={(personId) => updateMilestone(m.id, projectId, { ownerPersonId: personId })}
                      />
                    ) : (
                      <span className="text-sm text-slate-700">{m.ownerPersonName ?? "—"}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInput(m.plannedDate)} onSave={(v) => updateMilestone(m.id, projectId, { plannedDate: v })} />
                    ) : (
                      <DateCell value={m.plannedDate} />
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInput(m.forecastDate)} onSave={(v) => updateMilestone(m.id, projectId, { forecastDate: v })} />
                    ) : (
                      <DateCell value={m.forecastDate} />
                    )}
                    {variance !== null && variance !== 0 && (
                      <p className={`text-[11px] mt-0.5 ${variance > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {variance > 0 ? `+${variance}d` : `${variance}d`}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInput(m.actualDate)} onSave={(v) => updateMilestone(m.id, projectId, { actualDate: v })} />
                    ) : (
                      <DateCell value={m.actualDate} />
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite && (
                      <RowActionsMenu
                        actions={[
                          {
                            label: "Delete Milestone",
                            pendingLabel: "Deleting...",
                            danger: true,
                            onClick: () => deleteMilestone(m.id, projectId),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DateCell({ value }: { value: Date | null }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-400">
      <IconCalendar className="h-3.5 w-3.5 shrink-0" />
      <span className="text-sm text-slate-600">{formatDate(value)}</span>
    </div>
  );
}
