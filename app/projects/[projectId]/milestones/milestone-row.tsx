"use client";

import { InlinePercent, InlineSelect, InlineText } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField } from "@/components/ui/data-card";
import { STATUS_COLORS } from "@/lib/colors";
import { INVOICE_STATUSES, SIGNOFF_STATUSES, type ItemStatus } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import { updateMilestonePayment, updateMilestoneName } from "./milestone-actions";

export type MilestoneRowData = {
  id: string;
  checklistItemId: string;
  paymentPct: number;
  invoiceStatus: string;
  clientSignoff: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  sourceChecklist: string;
  stage: string;
  milestoneName: string;
  actualDate: Date | null;
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
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {canWrite ? (
            <InlineText
              value={milestone.milestoneName}
              onSave={(v) => updateMilestoneName(milestone.checklistItemId, projectId, v)}
            />
          ) : (
            <p className="text-sm font-medium text-slate-900">{milestone.milestoneName}</p>
          )}
          <p className="text-xs text-slate-400">
            {milestone.sourceChecklist} — {milestone.stage}
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0"
          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
        >
          {statusColor.label}
        </span>
      </div>

      <CardFieldGrid>
        <CardField label="Actual Date">{formatDate(milestone.actualDate)}</CardField>
        <CardField label="Payment %">
          {canWrite ? (
            <InlinePercent value={milestone.paymentPct} onSave={(v) => updateMilestonePayment(milestone.id, projectId, { paymentPct: v })} />
          ) : (
            `${Math.round(milestone.paymentPct * 1000) / 10}%`
          )}
        </CardField>
        <CardField label="Tranche Amount">
          <span className="font-medium text-slate-800">{formatMoney(trancheAmount(contractValue, milestone.paymentPct))}</span>
        </CardField>
        <CardField label="Invoice Status">
          {canWrite ? (
            <InlineSelect
              value={milestone.invoiceStatus}
              options={INVOICE_STATUSES}
              onSave={(v) => updateMilestonePayment(milestone.id, projectId, { invoiceStatus: v })}
            />
          ) : (
            milestone.invoiceStatus
          )}
        </CardField>
        <CardField label="Client Signoff">
          {canWrite ? (
            <InlineSelect
              value={milestone.clientSignoff}
              options={SIGNOFF_STATUSES}
              onSave={(v) => updateMilestonePayment(milestone.id, projectId, { clientSignoff: v })}
            />
          ) : (
            milestone.clientSignoff
          )}
        </CardField>
        {!notesHidden && (
          <CardField label="Notes" className="col-span-2">
            {canWrite ? (
              <InlineText value={milestone.notes ?? ""} placeholder="—" onSave={(v) => updateMilestonePayment(milestone.id, projectId, { notes: v })} />
            ) : (
              milestone.notes || "—"
            )}
          </CardField>
        )}
      </CardFieldGrid>
    </DataCard>
  );
}
