"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataCard, CardFieldGrid, CardField, CardIconButton } from "@/components/ui/data-card";
import { STATUS_COLORS, SLIPPED_FLAG_COLOR } from "@/lib/colors";
import { ITEM_STATUSES, type ChecklistType, type ItemStatus } from "@/lib/constants";
import { formatPct, formatDate, toDateInputValue } from "@/lib/format";
import { isSlipped, currentStage } from "@/lib/calculations";
import { updateChecklistItem, createChecklistItem, deleteChecklistItem } from "@/app/projects/[projectId]/checklist-actions";
import { TpmOverrideChecklistModal } from "@/components/rbac/tpm-override-checklist-modal";
import { PersonPicker } from "@/components/resourcing/person-picker";
import type { AccessLevel, Role } from "@prisma/client";

export type ChecklistTableItem = {
  id: string;
  order: number;
  stage: string;
  itemText: string;
  milestoneName: string | null;
  owner: string | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  plannedDate: Date | null;
  actualDate: Date | null;
  link: string | null;
  status: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  isCustom: boolean;
};

export function ChecklistTable({
  projectId,
  checklistType,
  items,
  stageOrder,
  stageLabel = "Stage",
  access,
  viewerRole,
  people,
}: {
  projectId: string;
  checklistType: ChecklistType;
  items: ChecklistTableItem[];
  stageOrder: readonly string[];
  stageLabel?: string;
  access: AccessLevel;
  viewerRole: Role;
  people: { id: string; name: string }[];
}) {
  const canWrite = access === "WRITE";
  const notesHidden = access === "READ_LIMITED";
  const canOverride = viewerRole === "TPM" && access === "READ_FULL";

  const groups = stageOrder
    .map((stage) => ({ stage, rows: items.filter((i) => i.stage === stage) }))
    .filter((g) => g.rows.length > 0);

  // Default to the first stage/category that isn't fully complete yet, so
  // opening the checklist lands you on the work still in front of you
  // instead of always Stage 1. "All" (everything stacked) is one click away.
  const firstIncomplete = currentStage(items, stageOrder);
  const [activeStage, setActiveStage] = useState<string>(groups.length > 1 && firstIncomplete ? firstIncomplete : "ALL");

  const visibleGroups = activeStage === "ALL" ? groups : groups.filter((g) => g.stage === activeStage);

  return (
    <div className="space-y-6">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <StagePill label="All" active={activeStage === "ALL"} onClick={() => setActiveStage("ALL")} />
          {groups.map((g) => {
            // N/A items are excluded from the denominator entirely and count
            // as "done" for the stage's completion flag (nothing left to do).
            const applicable = g.rows.filter((r) => r.status !== "NOT_APPLICABLE");
            const completed = applicable.filter((r) => r.status === "COMPLETED").length;
            const done = applicable.every((r) => r.status === "COMPLETED");
            return (
              <StagePill
                key={g.stage}
                label={`${g.stage} (${completed}/${applicable.length})`}
                active={activeStage === g.stage}
                done={done}
                onClick={() => setActiveStage(g.stage)}
              />
            );
          })}
        </div>
      )}

      <div className="space-y-8">
      {visibleGroups.map((group) => {
        const applicable = group.rows.filter((r) => r.status !== "NOT_APPLICABLE");
        const completed = applicable.filter((r) => r.status === "COMPLETED").length;
        return (
          <div key={group.stage}>
            <div className="flex items-center justify-between px-1 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-800">
                {stageLabel}: {group.stage}
              </h3>
              <span className="text-xs text-slate-500">
                {completed} / {applicable.length} complete ({formatPct(applicable.length ? completed / applicable.length : 0)})
              </span>
            </div>

            <div className="space-y-3">
              {group.rows.map((item) => {
                const slipped = isSlipped(item.plannedDate, item.actualDate, item.status);
                // A PM may reword an item they added themselves; rewording a fixed
                // template item's text is Admin-only (enforced server-side too).
                const canEditText = item.isCustom ? canWrite : viewerRole === "ADMIN";
                return (
                  <DataCard key={item.id}>
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
                            <InlineText
                              value={item.itemText}
                              onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { itemText: v })}
                            />
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-slate-900">{item.itemText}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.milestoneName && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                            {item.milestoneName}
                          </span>
                        )}
                        {canWrite && item.isCustom && (
                          <DeleteItemButton itemId={item.id} projectId={projectId} checklistType={checklistType} />
                        )}
                        {canWrite ? (
                          <InlineSelect
                            value={item.status}
                            options={ITEM_STATUSES}
                            renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
                            className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                            style={{
                              backgroundColor: STATUS_COLORS[item.status as ItemStatus].bg,
                              color: STATUS_COLORS[item.status as ItemStatus].text,
                            }}
                            onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { status: v as ItemStatus })}
                          />
                        ) : (
                          <StatusBadge status={item.status as ItemStatus} />
                        )}
                        {canOverride && <TpmOverrideChecklistModal projectId={projectId} checklistType={checklistType} item={item} />}
                      </div>
                    </div>

                    <CardFieldGrid>
                      <CardField label="Owner">
                        {canWrite ? (
                          <PersonPicker
                            personId={item.ownerPersonId}
                            legacyText={item.owner}
                            people={people}
                            onSave={(personId) => updateChecklistItem(item.id, projectId, checklistType, { ownerPersonId: personId })}
                          />
                        ) : (
                          item.ownerPersonName || item.owner || "—"
                        )}
                      </CardField>
                      <CardField label="Planned Date">
                        {canWrite ? (
                          <InlineDate
                            value={toDateInputValue(item.plannedDate)}
                            onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { plannedDate: v })}
                          />
                        ) : (
                          formatDate(item.plannedDate)
                        )}
                      </CardField>
                      <CardField label="Actual Date">
                        <div className="flex items-center gap-1.5">
                          {canWrite ? (
                            <InlineDate
                              value={toDateInputValue(item.actualDate)}
                              onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { actualDate: v })}
                            />
                          ) : (
                            <span>{formatDate(item.actualDate)}</span>
                          )}
                          {slipped && (
                            <span title="Actual Date has slipped past Planned Date" className="text-xs font-bold shrink-0" style={{ color: SLIPPED_FLAG_COLOR }}>
                              ⚠
                            </span>
                          )}
                        </div>
                      </CardField>
                      <CardField label="Link">
                        {canWrite ? (
                          <InlineText
                            value={item.link ?? ""}
                            placeholder="—"
                            onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { link: v })}
                          />
                        ) : item.link ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate block">
                            {item.link}
                          </a>
                        ) : (
                          "—"
                        )}
                      </CardField>
                      {!notesHidden && (
                        <CardField label="Notes" className="col-span-2 sm:col-span-3 lg:col-span-1">
                          {canWrite ? (
                            <InlineText
                              value={item.notes ?? ""}
                              placeholder="—"
                              onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { notes: v })}
                            />
                          ) : (
                            item.notes || "—"
                          )}
                        </CardField>
                      )}
                    </CardFieldGrid>
                  </DataCard>
                );
              })}
              {canWrite && <AddItemButton projectId={projectId} checklistType={checklistType} stage={group.stage} />}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function AddItemButton({ projectId, checklistType, stage }: { projectId: string; checklistType: ChecklistType; stage: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => createChecklistItem(projectId, checklistType, stage))}
      disabled={pending}
      className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-50"
    >
      {pending ? "Adding..." : "+ Add Item"}
    </button>
  );
}

function DeleteItemButton({ itemId, projectId, checklistType }: { itemId: string; projectId: string; checklistType: ChecklistType }) {
  const [pending, startTransition] = useTransition();
  return (
    <CardIconButton onClick={() => startTransition(() => deleteChecklistItem(itemId, projectId, checklistType))} disabled={pending} title="Delete custom item">
      ✕
    </CardIconButton>
  );
}

function StagePill({
  label,
  active,
  done,
  onClick,
}: {
  label: string;
  active: boolean;
  done?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : done
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
    </button>
  );
}
