"use client";

import { useState } from "react";
import clsx from "clsx";
import { InlineText, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataCard, CardFieldGrid, CardField } from "@/components/ui/data-card";
import { STATUS_COLORS, SLIPPED_FLAG_COLOR } from "@/lib/colors";
import { ITEM_STATUSES, type ChecklistType, type ItemStatus } from "@/lib/constants";
import { formatPct, formatDate, toDateInputValue } from "@/lib/format";
import { isSlipped } from "@/lib/calculations";
import { updateChecklistItem } from "@/app/projects/[projectId]/checklist-actions";
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
  forecastDate: Date | null;
  status: string;
  notes: string | null; // null when stripped by READ_LIMITED access
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
  const firstIncomplete = groups.find((g) => g.rows.some((r) => r.status !== "COMPLETED"));
  const [activeStage, setActiveStage] = useState<string>(groups.length > 1 && firstIncomplete ? firstIncomplete.stage : "ALL");

  const visibleGroups = activeStage === "ALL" ? groups : groups.filter((g) => g.stage === activeStage);

  return (
    <div className="space-y-6">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <StagePill label="All" active={activeStage === "ALL"} onClick={() => setActiveStage("ALL")} />
          {groups.map((g) => {
            const done = g.rows.every((r) => r.status === "COMPLETED");
            return (
              <StagePill
                key={g.stage}
                label={`${g.stage} (${g.rows.filter((r) => r.status === "COMPLETED").length}/${g.rows.length})`}
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
        const completed = group.rows.filter((r) => r.status === "COMPLETED").length;
        return (
          <div key={group.stage}>
            <div className="flex items-center justify-between px-1 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-800">
                {stageLabel}: {group.stage}
              </h3>
              <span className="text-xs text-slate-500">
                {completed} / {group.rows.length} complete ({formatPct(group.rows.length ? completed / group.rows.length : 0)})
              </span>
            </div>

            <div className="space-y-3">
              {group.rows.map((item) => {
                const slipped = isSlipped(item.plannedDate, item.forecastDate, item.status);
                return (
                  <DataCard key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-xs text-slate-400 mt-0.5 shrink-0">{item.order}</span>
                        <p className="text-sm font-medium text-slate-900">{item.itemText}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.milestoneName && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                            {item.milestoneName}
                          </span>
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
                      <CardField label="Forecast Date">
                        <div className="flex items-center gap-1.5">
                          {canWrite ? (
                            <InlineDate
                              value={toDateInputValue(item.forecastDate)}
                              onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { forecastDate: v })}
                            />
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
            </div>
          </div>
        );
      })}
      </div>
    </div>
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
