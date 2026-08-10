"use client";

import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { updateEscalation } from "./escalation-actions";

const STATUSES = ["Open", "Acknowledged", "Resolved"];

export type EscalationRowData = {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  status: string;
  createdByName: string;
};

export function EscalationRow({ projectId, item }: { projectId: string; item: EscalationRowData }) {
  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{item.type.replace("_", " ")}</td>
      <td className="px-3 py-1.5 text-slate-800 font-medium">{item.title}</td>
      <td className="px-3 py-1.5">
        <InlineText value={item.notes ?? ""} placeholder="—" onSave={(v) => updateEscalation(item.id, projectId, { notes: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect value={item.status} options={STATUSES} onSave={(v) => updateEscalation(item.id, projectId, { status: v })} />
      </td>
      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{item.createdByName}</td>
    </tr>
  );
}
