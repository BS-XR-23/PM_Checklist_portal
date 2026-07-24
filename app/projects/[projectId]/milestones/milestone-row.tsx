"use client";

import { InlinePercent, InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { STATUS_COLORS } from "@/lib/colors";
import { INVOICE_STATUSES, SIGNOFF_STATUSES, type ItemStatus } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import { updateMilestonePayment } from "./milestone-actions";

export type MilestoneRowData = {
  id: string;
  paymentPct: number;
  invoiceStatus: string;
  clientSignoff: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  sourceChecklist: string;
  stage: string;
  milestoneName: string;
  forecastDate: Date | null;
  status: ItemStatus;
};

export function MilestoneRow({
  projectId,
  contractValue,
  milestone,
  canWrite,
  notesHidden,
}: {
  projectId: string;
  contractValue: number;
  milestone: MilestoneRowData;
  canWrite: boolean;
  notesHidden: boolean;
}) {
  const statusColor = STATUS_COLORS[milestone.status];

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{milestone.sourceChecklist}</td>
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{milestone.stage}</td>
      <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-nowrap">{milestone.milestoneName}</td>
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatDate(milestone.forecastDate)}</td>
      <td className="px-3 py-1.5">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
        >
          {statusColor.label}
        </span>
      </td>
      {canWrite ? (
        <>
          <td className="px-3 py-1.5">
            <InlinePercent value={milestone.paymentPct} onSave={(v) => updateMilestonePayment(milestone.id, projectId, { paymentPct: v })} />
          </td>
          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{formatMoney(trancheAmount(contractValue, milestone.paymentPct))}</td>
          <td className="px-3 py-1.5">
            <InlineSelect
              value={milestone.invoiceStatus}
              options={INVOICE_STATUSES}
              onSave={(v) => updateMilestonePayment(milestone.id, projectId, { invoiceStatus: v })}
            />
          </td>
          <td className="px-3 py-1.5">
            <InlineSelect
              value={milestone.clientSignoff}
              options={SIGNOFF_STATUSES}
              onSave={(v) => updateMilestonePayment(milestone.id, projectId, { clientSignoff: v })}
            />
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-1.5 text-slate-600">{Math.round(milestone.paymentPct * 1000) / 10}%</td>
          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{formatMoney(trancheAmount(contractValue, milestone.paymentPct))}</td>
          <td className="px-3 py-1.5 text-slate-600">{milestone.invoiceStatus}</td>
          <td className="px-3 py-1.5 text-slate-600">{milestone.clientSignoff}</td>
        </>
      )}
      {!notesHidden && (
        <td className="px-3 py-1.5">
          {canWrite ? (
            <InlineText value={milestone.notes ?? ""} placeholder="—" onSave={(v) => updateMilestonePayment(milestone.id, projectId, { notes: v })} />
          ) : (
            <span className="text-slate-600">{milestone.notes || "—"}</span>
          )}
        </td>
      )}
    </tr>
  );
}
