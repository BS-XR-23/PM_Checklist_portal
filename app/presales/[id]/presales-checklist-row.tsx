"use client";

import { useTransition } from "react";
import { InlineText, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { STATUS_COLORS, SLIPPED_FLAG_COLOR } from "@/lib/colors";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { formatDate, toDateInputValue } from "@/lib/format";
import { isSlipped } from "@/lib/calculations";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { updatePresalesChecklistItem, deletePresalesChecklistItem } from "./checklist-actions";

export type PresalesChecklistRowData = {
  id: string;
  order: number;
  itemText: string;
  status: string;
  plannedDate: Date | null;
  forecastDate: Date | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  owner: string | null;
  notes: string | null;
  isCustom: boolean;
};

export function PresalesChecklistRow({
  presalesProjectId,
  item,
  canWrite,
  isAdmin,
  people,
}: {
  presalesProjectId: string;
  item: PresalesChecklistRowData;
  canWrite: boolean;
  isAdmin: boolean;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const slipped = isSlipped(item.plannedDate, item.forecastDate, item.status);
  // A PM may reword a custom item they added; rewording a fixed template
  // item's text is Admin-only, same rule the real checklist enforces.
  const canEditText = item.isCustom ? canWrite : isAdmin;

  return (
    <DataCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="text-xs text-slate-400 mt-0.5 shrink-0">{item.order}</span>
          {item.isCustom && (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide shrink-0 mt-0.5">
              Custom
            </span>
          )}
          {canEditText ? (
            <div className="flex-1 min-w-0">
              <InlineText value={item.itemText} onSave={(v) => updatePresalesChecklistItem(item.id, presalesProjectId, { itemText: v })} />
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-900">{item.itemText}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && item.isCustom && (
            <CardIconButton onClick={() => startTransition(() => deletePresalesChecklistItem(item.id, presalesProjectId))} disabled={pending} title="Delete custom item">
              ✕
            </CardIconButton>
          )}
          {canWrite ? (
            <InlineSelect
              value={item.status}
              options={ITEM_STATUSES}
              renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
              className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              style={{ backgroundColor: STATUS_COLORS[item.status as ItemStatus].bg, color: STATUS_COLORS[item.status as ItemStatus].text }}
              onSave={(v) => updatePresalesChecklistItem(item.id, presalesProjectId, { status: v as ItemStatus })}
            />
          ) : (
            <StatusBadge status={item.status as ItemStatus} />
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
              onSave={(personId) => updatePresalesChecklistItem(item.id, presalesProjectId, { ownerPersonId: personId })}
            />
          ) : (
            item.ownerPersonName || item.owner || "—"
          )}
        </CardField>
        <CardField label="Planned Date">
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.plannedDate)} onSave={(v) => updatePresalesChecklistItem(item.id, presalesProjectId, { plannedDate: v })} />
          ) : (
            formatDate(item.plannedDate)
          )}
        </CardField>
        <CardField label="Forecast Date">
          <div className="flex items-center gap-1.5">
            {canWrite ? (
              <InlineDate value={toDateInputValue(item.forecastDate)} onSave={(v) => updatePresalesChecklistItem(item.id, presalesProjectId, { forecastDate: v })} />
            ) : (
              <span>{formatDate(item.forecastDate)}</span>
            )}
            {slipped && (
              <span title="Forecast Date has slipped past Planned Date" className="text-xs font-bold shrink-0" style={{ color: SLIPPED_FLAG_COLOR }}>
                ⚠
              </span>
            )}
          </div>
        </CardField>
        <CardField label="Notes" className="col-span-2 sm:col-span-3 lg:col-span-1">
          {canWrite ? (
            <InlineText value={item.notes ?? ""} placeholder="—" onSave={(v) => updatePresalesChecklistItem(item.id, presalesProjectId, { notes: v })} />
          ) : (
            item.notes || "—"
          )}
        </CardField>
      </CardFieldGrid>
    </DataCard>
  );
}
