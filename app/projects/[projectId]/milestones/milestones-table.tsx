"use client";

import { InlinePercent, InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { NotesCell } from "@/components/ui/notes-cell";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconCalendar } from "@/components/layout/icons";
import { STATUS_COLORS } from "@/lib/colors";
import { INVOICE_STATUSES, SIGNOFF_STATUSES, type ItemStatus } from "@/lib/constants";
import type { ChecklistType } from "@/lib/checklist-types";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import { updateMilestonePayment, updateMilestoneName } from "./milestone-actions";

export type MilestoneTableRow = {
  id: string;
  checklistItemId: string;
  paymentPct: number;
  invoiceStatus: string;
  clientSignoff: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  checklistType: ChecklistType;
  stage: string;
  milestoneName: string;
  actualDate: Date | null;
  status: ItemStatus;
};

// DEV (Development Checklist) never actually appears here — its seed data
// deliberately carries no milestoneName, so it can never produce a
// MilestonePayment row (see lib/seed-data.ts) — but the entry is required
// for type completeness now that ChecklistType includes it.
const SOURCE_LABEL: Record<ChecklistType, string> = { PM: "PM", ENGINEERING: "Engineering", QA: "QA", DEVOPS: "DevOps", CREATIVE_XR: "Creative & XR", DEV: "Development" };
const SOURCE_STYLE: Record<ChecklistType, string> = {
  PM: "bg-indigo-50 text-indigo-700",
  ENGINEERING: "bg-violet-50 text-violet-700",
  QA: "bg-amber-50 text-amber-700",
  DEVOPS: "bg-blue-50 text-blue-700",
  CREATIVE_XR: "bg-pink-50 text-pink-700",
  DEV: "bg-slate-100 text-slate-700",
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
}: {
  projectId: string;
  contractValue: number;
  canWrite: boolean;
  notesHidden: boolean;
  totalAllocatedPct: number;
  allocationOff: boolean;
  rows: MilestoneTableRow[];
}) {
  const maxPct = Math.max(...rows.map((r) => r.paymentPct), 0.0001);
  const totalTranche = rows.reduce((sum, r) => sum + trancheAmount(contractValue, r.paymentPct), 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 w-10">#</th>
              <th className="px-3 py-2.5 min-w-[220px]">Milestone</th>
              <th className="px-3 py-2.5 w-24">Source</th>
              <th className="px-3 py-2.5 w-32">Payment %</th>
              <th className="px-3 py-2.5 w-32">Tranche Amount</th>
              <th className="px-3 py-2.5 w-36">Actual Date</th>
              <th className="px-3 py-2.5 w-36">Invoice Status</th>
              <th className="px-3 py-2.5 w-28">Client Signoff</th>
              <th className="px-3 py-2.5 w-28">Notes</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const statusColor = STATUS_COLORS[m.status];
              const signoffColor = SIGNOFF_STYLE[m.clientSignoff] ?? SIGNOFF_STYLE["N/A"];
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                  <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>

                  <td className="px-3 py-3">
                    {canWrite ? (
                      <InlineText value={m.milestoneName} onSave={(v) => updateMilestoneName(m.checklistItemId, projectId, v)} />
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{m.milestoneName}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {SOURCE_LABEL[m.checklistType]} Checklist — {m.stage}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${SOURCE_STYLE[m.checklistType]}`}>
                      {SOURCE_LABEL[m.checklistType]}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {canWrite ? (
                        <InlinePercent value={m.paymentPct} onSave={(v) => updateMilestonePayment(m.id, projectId, { paymentPct: v })} />
                      ) : (
                        <span className="text-sm text-slate-700">{formatPct(m.paymentPct)}</span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(m.paymentPct / maxPct) * 100}%`, backgroundColor: statusColor.bg }} />
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <span className="font-medium text-slate-800">{formatMoney(trancheAmount(contractValue, m.paymentPct))}</span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm text-slate-600">{formatDate(m.actualDate)}</span>
                    </div>
                    {!m.actualDate && <p className="text-[11px] text-slate-400 mt-0.5">(Planned)</p>}
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

                  <td className="px-3 py-3">
                    {canWrite && (
                      <RowActionsMenu
                        actions={[
                          {
                            label: "Remove from Milestones",
                            pendingLabel: "Removing...",
                            danger: true,
                            onClick: () => updateMilestoneName(m.checklistItemId, projectId, ""),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <td className="px-3 py-3" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-3" style={allocationOff ? { color: "#C00000" } : undefined}>
                {formatPct(totalAllocatedPct)}
                {allocationOff && <span className="block text-[11px] font-normal">should total 100%</span>}
              </td>
              <td className="px-3 py-3">{formatMoney(totalTranche)}</td>
              <td className="px-3 py-3 text-slate-400" colSpan={5}>
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
