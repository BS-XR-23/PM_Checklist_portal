"use client";

import { InlineDate, InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { UAT_DEFECT_SEVERITIES, UAT_DEFECT_STATUSES, RISK_LEVELS } from "@/lib/constants";
import { UAT_DEFECT_SEVERITY_COLORS, UAT_DEFECT_STATUS_COLORS } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import { updateUatDefect, deleteUatDefect } from "./uat-actions";

export type UatDefectRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  priority: string;
  status: string;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  uatCaseTitle: string | null;
  targetFixDate: Date | null;
  retestResult: string | null;
};

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function UatDefectsTable({
  projectId,
  canWrite,
  people,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  people: { id: string; name: string }[];
  rows: UatDefectRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No defects logged.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 min-w-[220px]">Defect</th>
              <th className="px-3 py-2.5 w-28">Severity</th>
              <th className="px-3 py-2.5 w-24">Priority</th>
              <th className="px-3 py-2.5 w-32">Status</th>
              <th className="px-3 py-2.5 w-32">Owner</th>
              <th className="px-3 py-2.5 w-36">Target Fix Date</th>
              <th className="px-3 py-2.5 w-32">Retest Result</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const sevColor = UAT_DEFECT_SEVERITY_COLORS[d.severity] ?? UAT_DEFECT_SEVERITY_COLORS.Medium;
              const statusColor = UAT_DEFECT_STATUS_COLORS[d.status] ?? UAT_DEFECT_STATUS_COLORS.Open;
              return (
                <tr key={d.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                  <td className="px-3 py-3">
                    {canWrite ? <InlineText value={d.title} onSave={(v) => updateUatDefect(d.id, projectId, { title: v })} /> : <p className="text-sm font-medium text-slate-900">{d.title}</p>}
                    {d.uatCaseTitle && <p className="text-xs text-slate-400 mt-0.5">from {d.uatCaseTitle}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={d.severity}
                        options={UAT_DEFECT_SEVERITIES}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: sevColor.bg, color: sevColor.text }}
                        onSave={(v) => updateUatDefect(d.id, projectId, { severity: v })}
                      />
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: sevColor.bg, color: sevColor.text }}>
                        {d.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect value={d.priority} options={RISK_LEVELS} onSave={(v) => updateUatDefect(d.id, projectId, { priority: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{d.priority}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={d.status}
                        options={UAT_DEFECT_STATUSES}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        onSave={(v) => updateUatDefect(d.id, projectId, { status: v })}
                      />
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
                        {d.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <PersonPicker personId={d.ownerPersonId} legacyText={null} people={people} onSave={(personId) => updateUatDefect(d.id, projectId, { ownerPersonId: personId })} />
                    ) : (
                      <span className="text-sm text-slate-700">{d.ownerPersonName ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInput(d.targetFixDate)} onSave={(v) => updateUatDefect(d.id, projectId, { targetFixDate: v })} />
                    ) : (
                      <span className="text-sm text-slate-600">{formatDate(d.targetFixDate)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineText value={d.retestResult ?? ""} onSave={(v) => updateUatDefect(d.id, projectId, { retestResult: v })} />
                    ) : (
                      <span className="text-sm text-slate-600">{d.retestResult ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite && <RowActionsMenu actions={[{ label: "Delete Defect", pendingLabel: "Deleting...", danger: true, onClick: () => deleteUatDefect(d.id, projectId) }]} />}
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
