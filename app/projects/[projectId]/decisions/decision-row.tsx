"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineDate } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { formatDate, toDateInputValue } from "@/lib/format";
import { updateDecision, deleteDecision } from "./decision-actions";

export type DecisionRowData = {
  id: string;
  date: Date | null;
  decision: string;
  rationale: string | null;
  decidedBy: string | null;
  decidedByPersonId: string | null;
  decidedByPersonName: string | null;
  notes: string | null;
};

export function DecisionRow({
  projectId,
  item,
  canWrite,
}: {
  projectId: string;
  item: DecisionRowData;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {canWrite ? (
            <InlineTextarea value={item.decision} onSave={(v) => updateDecision(item.id, projectId, { decision: v })} />
          ) : (
            <p className="text-sm font-medium text-slate-900">{item.decision}</p>
          )}
        </div>
        {canWrite && (
          <CardIconButton onClick={() => startTransition(() => deleteDecision(item.id, projectId))} disabled={pending} title="Delete decision">
            ✕
          </CardIconButton>
        )}
      </div>

      <CardFieldGrid>
        <CardField label="Date">
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.date)} onSave={(v) => updateDecision(item.id, projectId, { date: v })} />
          ) : (
            formatDate(item.date)
          )}
        </CardField>
        <CardField label="Decided By">
          {canWrite ? (
            // Free text, not a Person picker — "decided by" is often a
            // company/client, not an individual (e.g. "DED"), though it may
            // also name a specific person; a fixed People dropdown can't
            // represent both.
            <InlineText
              value={item.decidedByPersonName || item.decidedBy || ""}
              onSave={(v) => updateDecision(item.id, projectId, { decidedBy: v })}
            />
          ) : (
            item.decidedByPersonName || item.decidedBy || "—"
          )}
        </CardField>
        <CardField label="Rationale" className="col-span-2">
          {canWrite ? (
            <InlineTextarea value={item.rationale ?? ""} onSave={(v) => updateDecision(item.id, projectId, { rationale: v })} />
          ) : (
            item.rationale || "—"
          )}
        </CardField>
        <CardField label="Notes" className="col-span-2">
          {canWrite ? <InlineText value={item.notes ?? ""} onSave={(v) => updateDecision(item.id, projectId, { notes: v })} /> : item.notes || "—"}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
