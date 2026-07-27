"use client";

import { InlineText, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { StatusBadge } from "@/components/ui/status-badge";
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

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const completed = group.rows.filter((r) => r.status === "COMPLETED").length;
        return (
          <div key={group.stage} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-slate-800">
                {stageLabel}: {group.stage}
              </h3>
              <span className="text-xs text-slate-500">
                {completed} / {group.rows.length} complete ({formatPct(group.rows.length ? completed / group.rows.length : 0)})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-3 py-2 font-medium w-10">#</th>
                    <th className="px-3 py-2 font-medium min-w-[280px]">Checklist Item</th>
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 font-medium w-36">Owner</th>
                    <th className="px-3 py-2 font-medium w-40">Planned Date</th>
                    <th className="px-3 py-2 font-medium w-40">Forecast Date</th>
                    <th className="px-3 py-2 font-medium w-36">Status</th>
                    {!notesHidden && <th className="px-3 py-2 font-medium min-w-[200px]">Notes</th>}
                    {canOverride && <th className="px-3 py-2 font-medium w-24" />}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((item) => {
                    const slipped = isSlipped(item.plannedDate, item.forecastDate, item.status);
                    return (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0 align-top">
                        <td className="px-3 py-1.5 text-slate-400">{item.order}</td>
                        <td className="px-3 py-1.5 text-slate-800">{item.itemText}</td>
                        <td className="px-3 py-1.5">
                          {item.milestoneName && (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                              {item.milestoneName}
                            </span>
                          )}
                        </td>
                        {canWrite ? (
                          <>
                            <td className="px-3 py-1.5">
                              <PersonPicker
                                personId={item.ownerPersonId}
                                legacyText={item.owner}
                                people={people}
                                onSave={(personId) => updateChecklistItem(item.id, projectId, checklistType, { ownerPersonId: personId })}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <InlineDate
                                value={toDateInputValue(item.plannedDate)}
                                onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { plannedDate: v })}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                <InlineDate
                                  value={toDateInputValue(item.forecastDate)}
                                  onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { forecastDate: v })}
                                />
                                {slipped && (
                                  <span
                                    title="Forecast Date has slipped past Planned Date"
                                    className="text-xs font-bold shrink-0"
                                    style={{ color: SLIPPED_FLAG_COLOR }}
                                  >
                                    ⚠
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <InlineSelect
                                value={item.status}
                                options={ITEM_STATUSES}
                                renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
                                className="w-full rounded px-2 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                                style={{
                                  backgroundColor: STATUS_COLORS[item.status as ItemStatus].bg,
                                  color: STATUS_COLORS[item.status as ItemStatus].text,
                                }}
                                onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { status: v as ItemStatus })}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1.5 text-slate-600">{item.ownerPersonName || item.owner || "—"}</td>
                            <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(item.plannedDate)}</td>
                            <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                              {formatDate(item.forecastDate)}
                              {slipped && (
                                <span title="Forecast Date has slipped past Planned Date" className="ml-1 text-xs font-bold" style={{ color: SLIPPED_FLAG_COLOR }}>
                                  ⚠
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <StatusBadge status={item.status as ItemStatus} />
                            </td>
                          </>
                        )}
                        {!notesHidden && (
                          <td className="px-3 py-1.5">
                            {canWrite ? (
                              <InlineText
                                value={item.notes ?? ""}
                                placeholder="—"
                                onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { notes: v })}
                              />
                            ) : (
                              <span className="text-slate-600">{item.notes || "—"}</span>
                            )}
                          </td>
                        )}
                        {canOverride && (
                          <td className="px-3 py-1.5">
                            <TpmOverrideChecklistModal projectId={projectId} checklistType={checklistType} item={item} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
