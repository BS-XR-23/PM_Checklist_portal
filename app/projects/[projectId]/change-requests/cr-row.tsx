"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineSelect, InlineDate, InlineNumber } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { CR_TYPES, CR_SIGNOFF_STATUSES, CR_WBS_UPDATED, CR_STATUSES } from "@/lib/constants";
import { crAmount } from "@/lib/calculations";
import { formatMoney, formatDate, toDateInputValue } from "@/lib/format";
import { updateChangeRequest, deleteChangeRequest } from "./cr-actions";

export type CrRowData = {
  id: string;
  crCode: string;
  title: string;
  dateRaised: Date | null;
  description: string | null;
  manDaysPlanned: number | null;
  billableManDays: number | null;
  rate: number | null; // null when stripped by READ_LIMITED access
  type: string;
  clientSignoff: string;
  wbsUpdated: string;
  status: string;
  notes: string | null;
};

export function CrRow({
  projectId,
  cr,
  canWrite,
  financialsHidden,
}: {
  projectId: string;
  cr: CrRowData;
  canWrite: boolean;
  financialsHidden: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const amount = crAmount(cr.billableManDays, cr.rate);

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400 shrink-0">{cr.crCode}</span>
            {canWrite ? (
              <div className="flex-1">
                <InlineText value={cr.title} onSave={(v) => updateChangeRequest(cr.id, projectId, { title: v })} />
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-900">{cr.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canWrite ? (
            <InlineSelect
              value={cr.status}
              options={CR_STATUSES}
              className="rounded-full px-2.5 py-1 text-xs font-medium border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer bg-slate-50 text-slate-700"
              onSave={(v) => updateChangeRequest(cr.id, projectId, { status: v })}
            />
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">{cr.status}</span>
          )}
          {canWrite && (
            <CardIconButton onClick={() => startTransition(() => deleteChangeRequest(cr.id, projectId))} disabled={pending} title="Delete change request">
              ✕
            </CardIconButton>
          )}
        </div>
      </div>

      <CardFieldGrid>
        <CardField label="Date Raised">
          {canWrite ? (
            <InlineDate value={toDateInputValue(cr.dateRaised)} onSave={(v) => updateChangeRequest(cr.id, projectId, { dateRaised: v })} />
          ) : (
            formatDate(cr.dateRaised)
          )}
        </CardField>
        <CardField label="Type">
          {canWrite ? <InlineSelect value={cr.type} options={CR_TYPES} onSave={(v) => updateChangeRequest(cr.id, projectId, { type: v })} /> : cr.type}
        </CardField>
        <CardField label="Man-Days Planned">
          {canWrite ? (
            <InlineNumber value={cr.manDaysPlanned} step={0.5} onSave={(v) => updateChangeRequest(cr.id, projectId, { manDaysPlanned: v })} />
          ) : (
            cr.manDaysPlanned ?? "—"
          )}
        </CardField>
        <CardField label="Billable Man-Days">
          {canWrite ? (
            <InlineNumber value={cr.billableManDays} step={0.5} onSave={(v) => updateChangeRequest(cr.id, projectId, { billableManDays: v })} />
          ) : (
            cr.billableManDays ?? "—"
          )}
        </CardField>
        {!financialsHidden && (
          <CardField label="Rate">
            {canWrite ? <InlineNumber value={cr.rate} step={1} onSave={(v) => updateChangeRequest(cr.id, projectId, { rate: v })} /> : cr.rate ?? "—"}
          </CardField>
        )}
        {!financialsHidden && (
          <CardField label="Amount">
            <span className="font-medium text-slate-800">{amount == null ? "—" : formatMoney(amount)}</span>
          </CardField>
        )}
        <CardField label="Client Signoff">
          {canWrite ? (
            <InlineSelect value={cr.clientSignoff} options={CR_SIGNOFF_STATUSES} onSave={(v) => updateChangeRequest(cr.id, projectId, { clientSignoff: v })} />
          ) : (
            cr.clientSignoff
          )}
        </CardField>
        <CardField label="WBS Updated">
          {canWrite ? (
            <InlineSelect value={cr.wbsUpdated} options={CR_WBS_UPDATED} onSave={(v) => updateChangeRequest(cr.id, projectId, { wbsUpdated: v })} />
          ) : (
            cr.wbsUpdated
          )}
        </CardField>
        <CardField label="Description" className="col-span-2">
          {canWrite ? (
            <InlineTextarea value={cr.description ?? ""} onSave={(v) => updateChangeRequest(cr.id, projectId, { description: v })} />
          ) : (
            cr.description || "—"
          )}
        </CardField>
        <CardField label="Notes" className="col-span-2">
          {canWrite ? <InlineText value={cr.notes ?? ""} onSave={(v) => updateChangeRequest(cr.id, projectId, { notes: v })} /> : cr.notes || "—"}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
