"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineSelect, InlineDate, InlineNumber } from "@/components/ui/inline-edit";
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

  if (!canWrite) {
    return (
      <tr className="border-b border-slate-50 last:border-0 align-top">
        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap font-medium">{cr.crCode}</td>
        <td className="px-3 py-1.5 text-slate-800">{cr.title}</td>
        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(cr.dateRaised)}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.description || "—"}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.manDaysPlanned ?? "—"}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.billableManDays ?? "—"}</td>
        {!financialsHidden && <td className="px-3 py-1.5 text-slate-600">{cr.rate ?? "—"}</td>}
        {!financialsHidden && <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{amount == null ? "—" : formatMoney(amount)}</td>}
        <td className="px-3 py-1.5 text-slate-600">{cr.type}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.clientSignoff}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.wbsUpdated}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.status}</td>
        <td className="px-3 py-1.5 text-slate-600">{cr.notes || "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap font-medium">{cr.crCode}</td>
      <td className="px-3 py-1.5">
        <InlineText value={cr.title} onSave={(v) => updateChangeRequest(cr.id, projectId, { title: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineDate
          value={toDateInputValue(cr.dateRaised)}
          onSave={(v) => updateChangeRequest(cr.id, projectId, { dateRaised: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineTextarea value={cr.description ?? ""} onSave={(v) => updateChangeRequest(cr.id, projectId, { description: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineNumber
          value={cr.manDaysPlanned}
          step={0.5}
          onSave={(v) => updateChangeRequest(cr.id, projectId, { manDaysPlanned: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineNumber
          value={cr.billableManDays}
          step={0.5}
          onSave={(v) => updateChangeRequest(cr.id, projectId, { billableManDays: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineNumber value={cr.rate} step={1} onSave={(v) => updateChangeRequest(cr.id, projectId, { rate: v })} />
      </td>
      <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{amount == null ? "—" : formatMoney(amount)}</td>
      <td className="px-3 py-1.5">
        <InlineSelect value={cr.type} options={CR_TYPES} onSave={(v) => updateChangeRequest(cr.id, projectId, { type: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect
          value={cr.clientSignoff}
          options={CR_SIGNOFF_STATUSES}
          onSave={(v) => updateChangeRequest(cr.id, projectId, { clientSignoff: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect
          value={cr.wbsUpdated}
          options={CR_WBS_UPDATED}
          onSave={(v) => updateChangeRequest(cr.id, projectId, { wbsUpdated: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect value={cr.status} options={CR_STATUSES} onSave={(v) => updateChangeRequest(cr.id, projectId, { status: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineText value={cr.notes ?? ""} onSave={(v) => updateChangeRequest(cr.id, projectId, { notes: v })} />
      </td>
      <td className="px-3 py-1.5">
        <button
          onClick={() => startTransition(() => deleteChangeRequest(cr.id, projectId))}
          disabled={pending}
          title="Delete change request"
          className="text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
