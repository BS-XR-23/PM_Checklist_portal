"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { RISK_LEVELS, RISK_TYPES, RISK_STATUSES } from "@/lib/constants";
import { RISK_SEVERITY_COLORS, riskScoreSeverity } from "@/lib/colors";
import { riskScore } from "@/lib/calculations";
import { formatDate, toDateInputValue } from "@/lib/format";
import { updateRisk, deleteRisk } from "./risk-actions";

export type RiskRowData = {
  id: string;
  type: string;
  category: string | null;
  description: string;
  probability: string;
  impact: string;
  owner: string | null;
  mitigation: string | null;
  status: string;
  dateRaised: Date | null;
  dateClosed: Date | null;
  notes: string | null;
};

export function RiskRow({ projectId, risk, canWrite }: { projectId: string; risk: RiskRowData; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();
  const score = riskScore(risk.probability, risk.impact);
  const severity = RISK_SEVERITY_COLORS[riskScoreSeverity(score)];

  if (!canWrite) {
    return (
      <tr className="border-b border-slate-50 last:border-0 align-top">
        <td className="px-3 py-1.5 text-slate-600">{risk.type}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.category || "—"}</td>
        <td className="px-3 py-1.5 text-slate-800">{risk.description}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.probability}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.impact}</td>
        <td className="px-3 py-1.5">
          <span className="inline-flex items-center justify-center rounded-full w-8 h-6 text-xs font-semibold" style={{ backgroundColor: severity.bg, color: severity.text }}>
            {score}
          </span>
        </td>
        <td className="px-3 py-1.5 text-slate-600">{risk.owner || "—"}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.mitigation || "—"}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.status}</td>
        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(risk.dateRaised)}</td>
        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(risk.dateClosed)}</td>
        <td className="px-3 py-1.5 text-slate-600">{risk.notes || "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-1.5">
        <InlineSelect value={risk.type} options={RISK_TYPES} onSave={(v) => updateRisk(risk.id, projectId, { type: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineText value={risk.category ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { category: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineTextarea value={risk.description} onSave={(v) => updateRisk(risk.id, projectId, { description: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect
          value={risk.probability}
          options={RISK_LEVELS}
          onSave={(v) => updateRisk(risk.id, projectId, { probability: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect value={risk.impact} options={RISK_LEVELS} onSave={(v) => updateRisk(risk.id, projectId, { impact: v })} />
      </td>
      <td className="px-3 py-1.5">
        <span
          className="inline-flex items-center justify-center rounded-full w-8 h-6 text-xs font-semibold"
          style={{ backgroundColor: severity.bg, color: severity.text }}
        >
          {score}
        </span>
      </td>
      <td className="px-3 py-1.5">
        <InlineText value={risk.owner ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { owner: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineTextarea value={risk.mitigation ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { mitigation: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineSelect value={risk.status} options={RISK_STATUSES} onSave={(v) => updateRisk(risk.id, projectId, { status: v })} />
      </td>
      <td className="px-3 py-1.5">
        <InlineDate
          value={toDateInputValue(risk.dateRaised)}
          onSave={(v) => updateRisk(risk.id, projectId, { dateRaised: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineDate
          value={toDateInputValue(risk.dateClosed)}
          onSave={(v) => updateRisk(risk.id, projectId, { dateClosed: v })}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineText value={risk.notes ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { notes: v })} />
      </td>
      <td className="px-3 py-1.5">
        <button
          onClick={() => startTransition(() => deleteRisk(risk.id, projectId))}
          disabled={pending}
          title="Delete risk"
          className="text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
