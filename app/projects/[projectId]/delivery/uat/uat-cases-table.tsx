"use client";

import { InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { NotesCell } from "@/components/ui/notes-cell";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { UAT_CASE_STATUSES, RISK_LEVELS } from "@/lib/constants";
import { UAT_CASE_STATUS_COLORS } from "@/lib/colors";
import { updateUatCase, deleteUatCase } from "./uat-actions";

export type UatCaseRow = {
  id: string;
  title: string;
  scenario: string | null;
  steps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  priority: string;
  status: string;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  releaseId: string | null;
  releaseLabel: string | null;
  notes: string | null;
};

export function UatCasesTable({
  projectId,
  canWrite,
  people,
  releases,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  people: { id: string; name: string }[];
  releases: { id: string; label: string }[];
  rows: UatCaseRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No test cases yet.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 min-w-[220px]">Test Case</th>
              <th className="px-3 py-2.5 w-32">Release</th>
              <th className="px-3 py-2.5 w-24">Priority</th>
              <th className="px-3 py-2.5 w-32">Status</th>
              <th className="px-3 py-2.5 w-32">Owner</th>
              <th className="px-3 py-2.5 w-28">Notes</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const statusColor = UAT_CASE_STATUS_COLORS[c.status] ?? UAT_CASE_STATUS_COLORS.NOT_STARTED;
              return (
                <tr key={c.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                  <td className="px-3 py-3">
                    {canWrite ? <InlineText value={c.title} onSave={(v) => updateUatCase(c.id, projectId, { title: v })} /> : <p className="text-sm font-medium text-slate-900">{c.title}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <select
                        defaultValue={c.releaseId ?? ""}
                        onChange={(e) => updateUatCase(c.id, projectId, { releaseId: e.target.value || null })}
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {releases.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-600">{c.releaseLabel ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect value={c.priority} options={RISK_LEVELS} onSave={(v) => updateUatCase(c.id, projectId, { priority: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{c.priority}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={c.status}
                        options={UAT_CASE_STATUSES}
                        renderOption={(s) => UAT_CASE_STATUS_COLORS[s].label}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        onSave={(v) => updateUatCase(c.id, projectId, { status: v })}
                      />
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
                        {statusColor.label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <PersonPicker personId={c.ownerPersonId} legacyText={null} people={people} onSave={(personId) => updateUatCase(c.id, projectId, { ownerPersonId: personId })} />
                    ) : (
                      <span className="text-sm text-slate-700">{c.ownerPersonName ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <NotesCell value={c.notes} canWrite={canWrite} onSave={(v) => updateUatCase(c.id, projectId, { notes: v })} />
                  </td>
                  <td className="px-3 py-3">
                    {canWrite && <RowActionsMenu actions={[{ label: "Delete Test Case", pendingLabel: "Deleting...", danger: true, onClick: () => deleteUatCase(c.id, projectId) }]} />}
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
