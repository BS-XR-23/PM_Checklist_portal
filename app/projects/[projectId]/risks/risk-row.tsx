"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { RISK_LEVELS, RISK_TYPES, RISK_STATUSES } from "@/lib/constants";
import { RISK_SEVERITY_COLORS, riskScoreSeverity } from "@/lib/colors";
import { riskScore } from "@/lib/calculations";
import { formatDate, toDateInputValue } from "@/lib/format";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { updateRisk, deleteRisk } from "./risk-actions";

export type RiskRowData = {
  id: string;
  type: string;
  category: string | null;
  description: string;
  probability: string;
  impact: string;
  owner: string | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  mitigation: string | null;
  status: string;
  dateRaised: Date | null;
  dateClosed: Date | null;
  notes: string | null;
};

export function RiskRow({
  projectId,
  risk,
  canWrite,
  people,
}: {
  projectId: string;
  risk: RiskRowData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const score = riskScore(risk.probability, risk.impact);
  const severity = RISK_SEVERITY_COLORS[riskScoreSeverity(score)];

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {canWrite ? (
            <InlineTextarea value={risk.description} onSave={(v) => updateRisk(risk.id, projectId, { description: v })} />
          ) : (
            <p className="text-sm font-medium text-slate-900">{risk.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-flex items-center justify-center rounded-full w-8 h-6 text-xs font-semibold"
            style={{ backgroundColor: severity.bg, color: severity.text }}
            title={`Risk score ${score} (${severity.label})`}
          >
            {score}
          </span>
          {canWrite && (
            <CardIconButton onClick={() => startTransition(() => deleteRisk(risk.id, projectId))} disabled={pending} title="Delete risk">
              ✕
            </CardIconButton>
          )}
        </div>
      </div>

      <CardFieldGrid>
        <CardField label="Type">
          {canWrite ? <InlineSelect value={risk.type} options={RISK_TYPES} onSave={(v) => updateRisk(risk.id, projectId, { type: v })} /> : risk.type}
        </CardField>
        <CardField label="Category">
          {canWrite ? (
            <InlineText value={risk.category ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { category: v })} />
          ) : (
            risk.category || "—"
          )}
        </CardField>
        <CardField label="Probability">
          {canWrite ? (
            <InlineSelect value={risk.probability} options={RISK_LEVELS} onSave={(v) => updateRisk(risk.id, projectId, { probability: v })} />
          ) : (
            risk.probability
          )}
        </CardField>
        <CardField label="Impact">
          {canWrite ? <InlineSelect value={risk.impact} options={RISK_LEVELS} onSave={(v) => updateRisk(risk.id, projectId, { impact: v })} /> : risk.impact}
        </CardField>
        <CardField label="Owner">
          {canWrite ? (
            <PersonPicker
              personId={risk.ownerPersonId}
              legacyText={risk.owner}
              people={people}
              onSave={(personId) => updateRisk(risk.id, projectId, { ownerPersonId: personId })}
            />
          ) : (
            risk.ownerPersonName || risk.owner || "—"
          )}
        </CardField>
        <CardField label="Status">
          {canWrite ? (
            <InlineSelect value={risk.status} options={RISK_STATUSES} onSave={(v) => updateRisk(risk.id, projectId, { status: v })} />
          ) : (
            risk.status
          )}
        </CardField>
        <CardField label="Date Raised">
          {canWrite ? (
            <InlineDate value={toDateInputValue(risk.dateRaised)} onSave={(v) => updateRisk(risk.id, projectId, { dateRaised: v })} />
          ) : (
            formatDate(risk.dateRaised)
          )}
        </CardField>
        <CardField label="Date Closed">
          {canWrite ? (
            <InlineDate value={toDateInputValue(risk.dateClosed)} onSave={(v) => updateRisk(risk.id, projectId, { dateClosed: v })} />
          ) : (
            formatDate(risk.dateClosed)
          )}
        </CardField>
        <CardField label="Mitigation / Response Plan" className="col-span-2">
          {canWrite ? (
            <InlineTextarea value={risk.mitigation ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { mitigation: v })} />
          ) : (
            risk.mitigation || "—"
          )}
        </CardField>
        <CardField label="Notes" className="col-span-2">
          {canWrite ? <InlineText value={risk.notes ?? ""} onSave={(v) => updateRisk(risk.id, projectId, { notes: v })} /> : risk.notes || "—"}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
