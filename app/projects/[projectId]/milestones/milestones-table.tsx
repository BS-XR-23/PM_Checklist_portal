"use client";

import { InlineDate, InlinePercent, InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { NotesCell } from "@/components/ui/notes-cell";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { STATUS_COLORS, SLIPPED_FLAG_COLOR } from "@/lib/colors";
import { INVOICE_STATUSES, ITEM_STATUSES, MILESTONE_TYPE_LABELS, SIGNOFF_STATUSES, type ItemStatus } from "@/lib/constants";
import { formatDate, formatMoney, formatPct, toDateInputValue } from "@/lib/format";
import { isSlipped, trancheAmount } from "@/lib/calculations";
import { updateMilestone, updateMilestonePayment, deleteMilestone } from "./milestone-actions";

export type MilestoneTableRow = {
  id: string;
  name: string;
  type: string;
  plannedDate: Date | null;
  forecastDate: Date | null;
  actualDate: Date | null;
  status: ItemStatus;
  ownerPersonId: string | null;
  ownerName: string | null;
  paymentPct: number;
  invoiceStatus: string;
  clientSignoff: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  // Checklist gates linked to this milestone (ChecklistItem.milestoneId) —
  // internal checkpoints that should be done before it; display only.
  gatesDone: number;
  gatesTotal: number;
};

const SIGNOFF_STYLE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#FFE699", text: "#7A5B00" },
  Signed: { bg: "#C6E0B4", text: "#2C5F2D" },
  Acknowledged: { bg: "#DBEAFE", text: "#1D4ED8" },
  "N/A": { bg: "#E2E8F0", text: "#475569" },
};

export function MilestonesTable({
  projectId,
  contractValue,
  canWrite,
  notesHidden,
  totalAllocatedPct,
  allocationOff,
  rows,
  people,
}: {
  projectId: string;
  contractValue: number;
  canWrite: boolean;
  notesHidden: boolean;
  totalAllocatedPct: number;
  allocationOff: boolean;
  rows: MilestoneTableRow[];
  people: { id: string; name: string }[];
}) {
  const totalTranche = rows.reduce((sum, r) => sum + trancheAmount(contractValue, r.paymentPct), 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-700">No milestones yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Add the commitments this project delivers to the client — e.g. Phase 1 MVP, UAT Complete, Go-Live — and
          split the contract&apos;s payment across them.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1500px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 w-10">#</th>
              <th className="px-3 py-2.5 min-w-[220px]">Milestone</th>
              <th className="px-3 py-2.5 w-44">Owner</th>
              <th className="px-3 py-2.5 w-36">Planned</th>
              <th className="px-3 py-2.5 w-36">Forecast</th>
              <th className="px-3 py-2.5 w-36">Actual</th>
              <th className="px-3 py-2.5 w-36">Status</th>
              <th className="px-3 py-2.5 w-28">Payment %</th>
              <th className="px-3 py-2.5 w-28">Tranche</th>
              <th className="px-3 py-2.5 w-36">Invoice</th>
              <th className="px-3 py-2.5 w-32">Client Signoff</th>
              <th className="px-3 py-2.5 w-24">Notes</th>
              {canWrite && <th className="px-3 py-2.5 w-14" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const statusColor = STATUS_COLORS[m.status] ?? STATUS_COLORS.NOT_STARTED;
              const signoffColor = SIGNOFF_STYLE[m.clientSignoff] ?? SIGNOFF_STYLE["N/A"];
              const slipped = isSlipped(m.plannedDate, m.forecastDate, m.status);
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                  <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineText value={m.name} onSave={(v) => updateMilestone(m.id, projectId, { name: v })} />
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {MILESTONE_TYPE_LABELS[m.type] ?? m.type}
                      {m.gatesTotal > 0 && (
                        <span title="Checklist gates linked to this milestone">
                          {" "}
                          · Gates {m.gatesDone}/{m.gatesTotal}
                        </span>
                      )}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <div className="min-w-[160px]">
                        <PersonPicker
                          personId={m.ownerPersonId}
                          legacyText={null}
                          people={people}
                          onSave={(personId) => updateMilestone(m.id, projectId, { ownerPersonId: personId })}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-700">{m.ownerName ?? "—"}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInputValue(m.plannedDate)} onSave={(v) => updateMilestone(m.id, projectId, { plannedDate: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{formatDate(m.plannedDate)}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInputValue(m.forecastDate)} onSave={(v) => updateMilestone(m.id, projectId, { forecastDate: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{formatDate(m.forecastDate)}</span>
                    )}
                    {slipped && (
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: SLIPPED_FLAG_COLOR }}>
                        ⚠ slipped past plan
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineDate value={toDateInputValue(m.actualDate)} onSave={(v) => updateMilestone(m.id, projectId, { actualDate: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{formatDate(m.actualDate)}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={m.status}
                        options={ITEM_STATUSES}
                        renderOption={(s) => STATUS_COLORS[s as ItemStatus]?.label ?? s}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        onSave={(v) => updateMilestone(m.id, projectId, { status: v })}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                      >
                        {statusColor.label}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlinePercent value={m.paymentPct} onSave={(v) => updateMilestonePayment(m.id, projectId, { paymentPct: v })} />
                    ) : (
                      <span className="text-sm text-slate-700">{formatPct(m.paymentPct)}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <span className="font-medium text-slate-800">{formatMoney(trancheAmount(contractValue, m.paymentPct))}</span>
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={m.invoiceStatus}
                        options={INVOICE_STATUSES}
                        onSave={(v) => updateMilestonePayment(m.id, projectId, { invoiceStatus: v })}
                      />
                    ) : (
                      <span className="text-sm text-slate-700">{m.invoiceStatus}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineSelect
                        value={m.clientSignoff}
                        options={SIGNOFF_STATUSES}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        style={{ backgroundColor: signoffColor.bg, color: signoffColor.text }}
                        onSave={(v) => updateMilestonePayment(m.id, projectId, { clientSignoff: v })}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: signoffColor.bg, color: signoffColor.text }}
                      >
                        {m.clientSignoff}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {!notesHidden && (
                      <NotesCell value={m.notes} canWrite={canWrite} onSave={(v) => updateMilestonePayment(m.id, projectId, { notes: v })} />
                    )}
                  </td>

                  {canWrite && (
                    <td className="px-3 py-3">
                      <RowActionsMenu
                        actions={[
                          {
                            label: "Delete milestone",
                            pendingLabel: "Deleting...",
                            danger: true,
                            confirmMessage: `Delete milestone "${m.name}" and its payment details? This can't be undone.`,
                            onClick: () => deleteMilestone(m.id, projectId),
                          },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <td className="px-3 py-3" colSpan={7}>
                Total
              </td>
              <td className="px-3 py-3" style={allocationOff ? { color: "#C00000" } : undefined}>
                {formatPct(totalAllocatedPct)}
                {allocationOff && <span className="block text-[11px] font-normal">should total 100%</span>}
              </td>
              <td className="px-3 py-3">{formatMoney(totalTranche)}</td>
              <td className="px-3 py-3" colSpan={canWrite ? 4 : 3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
