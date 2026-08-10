"use client";

import { useTransition } from "react";
import { InlineText, InlineTextarea, InlineDate } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { formatDate, toDateInputValue } from "@/lib/format";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { updatePresalesDecision, deletePresalesDecision } from "./decision-actions";

export type PresalesDecisionRowData = {
  id: string;
  date: Date | null;
  decision: string;
  rationale: string | null;
  decidedBy: string | null;
  decidedByPersonId: string | null;
  decidedByPersonName: string | null;
  notes: string | null;
};

export function PresalesDecisionRow({
  presalesProjectId,
  item,
  canWrite,
  people,
}: {
  presalesProjectId: string;
  item: PresalesDecisionRowData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {canWrite ? (
            <InlineTextarea value={item.decision} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { decision: v })} />
          ) : (
            <p className="text-sm font-medium text-slate-900">{item.decision}</p>
          )}
        </div>
        {canWrite && (
          <CardIconButton onClick={() => startTransition(() => deletePresalesDecision(item.id, presalesProjectId))} disabled={pending} title="Delete decision">
            ✕
          </CardIconButton>
        )}
      </div>

      <CardFieldGrid>
        <CardField label="Date">
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.date)} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { date: v })} />
          ) : (
            formatDate(item.date)
          )}
        </CardField>
        <CardField label="Decided By">
          {canWrite ? (
            <PersonPicker
              personId={item.decidedByPersonId}
              legacyText={item.decidedBy}
              people={people}
              onSave={(personId) => updatePresalesDecision(item.id, presalesProjectId, { decidedByPersonId: personId })}
            />
          ) : (
            item.decidedByPersonName || item.decidedBy || "—"
          )}
        </CardField>
        <CardField label="Rationale" className="col-span-2">
          {canWrite ? (
            <InlineTextarea value={item.rationale ?? ""} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { rationale: v })} />
          ) : (
            item.rationale || "—"
          )}
        </CardField>
        <CardField label="Notes" className="col-span-2">
          {canWrite ? (
            <InlineText value={item.notes ?? ""} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { notes: v })} />
          ) : (
            item.notes || "—"
          )}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
