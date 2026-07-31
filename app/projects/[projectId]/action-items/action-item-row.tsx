"use client";

import { useTransition } from "react";
import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { formatDate, toDateInputValue } from "@/lib/format";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { updateActionItem, deleteActionItem } from "./action-item-actions";
import { ActionItemStatusToggle } from "./action-item-status-toggle";

export type ActionItemRowData = {
  id: string;
  description: string;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  owner: string | null;
  dueDate: Date | null;
  status: string;
  notes: string | null;
};

export function ActionItemRow({
  projectId,
  item,
  canWrite,
  people,
}: {
  projectId: string;
  item: ActionItemRowData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {canWrite ? (
            <InlineText value={item.description} onSave={(v) => updateActionItem(item.id, projectId, { description: v })} />
          ) : (
            <p className="text-sm font-medium text-slate-900">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canWrite ? (
            <ActionItemStatusToggle id={item.id} projectId={projectId} status={item.status} />
          ) : (
            <span
              className={
                item.status === "Done"
                  ? "inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium"
                  : "inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-medium"
              }
            >
              {item.status === "Done" ? "✓ Done" : "Open"}
            </span>
          )}
          {canWrite && (
            <CardIconButton onClick={() => startTransition(() => deleteActionItem(item.id, projectId))} disabled={pending} title="Delete action item">
              ✕
            </CardIconButton>
          )}
        </div>
      </div>

      <CardFieldGrid>
        <CardField label="Owner">
          {canWrite ? (
            <PersonPicker
              personId={item.ownerPersonId}
              legacyText={item.owner}
              people={people}
              onSave={(personId) => updateActionItem(item.id, projectId, { ownerPersonId: personId })}
            />
          ) : (
            item.ownerPersonName || item.owner || "—"
          )}
        </CardField>
        <CardField label="Due Date">
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.dueDate)} onSave={(v) => updateActionItem(item.id, projectId, { dueDate: v })} />
          ) : (
            formatDate(item.dueDate)
          )}
        </CardField>
        <CardField label="Notes" className="col-span-2">
          {canWrite ? (
            <InlineText value={item.notes ?? ""} onSave={(v) => updateActionItem(item.id, projectId, { notes: v })} />
          ) : (
            item.notes || "—"
          )}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
