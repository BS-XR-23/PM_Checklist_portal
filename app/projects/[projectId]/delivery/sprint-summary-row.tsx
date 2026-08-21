"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDate, toDateInputValue } from "@/lib/format";
import { competencyCpi } from "@/lib/calculations";
import { INDEX_BAND_COLORS, indexBand, STATUS_COLORS, avatarColorFromString } from "@/lib/colors";
import { initials } from "@/lib/format";
import { InlinePercent, InlineNumber, InlineText, InlineDate } from "@/components/ui/inline-edit";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconTarget, IconCheckCircle, IconClock, IconChart, IconUsers, IconClipboardList } from "@/components/layout/icons";
import { computeDuplicateRefs, DuplicateBadge } from "./duplicate-badge";
import {
  closeSprint,
  updateSprint,
  deleteSprint,
  updateWbsTask,
  assignTaskToSprint,
  updateTaskProgress,
  addSprintAllocation,
  updateSprintAllocation,
  deleteSprintAllocation,
} from "./delivery-actions";
import type { RosterPerson } from "./delivery-tasks-table";

// Compact colored badge for the collapsed summary row's dense inline PV/EV/AV
// bar. The modal's own SPI/CPI figures use StatTile's valueColor instead.
function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const band = INDEX_BAND_COLORS[indexBand(value)];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold"
      style={{ backgroundColor: band.bg, color: band.text }}
    >
      {value.toFixed(2)}
    </span>
  );
}

// Every row in this table is, by definition, committed to a sprint — so
// unlike the Tasks tab's derivation there's no "Not Started" state here:
// commitment alone already means work is underway.
function StatusPill({ pctComplete }: { pctComplete: number }) {
  const status = STATUS_COLORS[pctComplete >= 1 ? "COMPLETED" : "IN_PROGRESS"];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: status.bg, color: status.text }}
    >
      {status.label}
    </span>
  );
}

function PersonAvatar({ name }: { name: string | null }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: avatarColorFromString(name ?? "?") }}
    >
      {initials(name ?? "?")}
    </span>
  );
}

// A task committed to an OPEN sprint — tracked directly (no weekly rows),
// editable inline below.
export type SprintTaskDrillDown = {
  id: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
  actualHours: number;
  personId: string | null;
  personName: string | null;
};

// One row of a CLOSED sprint's frozenTaskSnapshot — permanent record of
// which tasks earned the frozen PV/EV/AV, immune to later edits on the
// (mutable) WbsTask rows themselves.
export type FrozenTaskSnapshotEntry = {
  taskId: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
};

// A backlog task not yet committed to any sprint — offered by the "import
// from backlog" picker below. Tasks are still defined on the Tasks tab;
// this only commits an existing one.
export type BacklogTaskOption = {
  id: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
};

export type SprintAllocationData = {
  id: string;
  personId: string;
  personName: string;
  competencyLevel: string | null;
  allocationPct: number;
  jiraHours: number | null;
};

export type SprintSummaryData = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  pv: number;
  ev: number;
  av: number;
  tasks: SprintTaskDrillDown[]; // live — only used while open
  frozenTasks: FrozenTaskSnapshotEntry[]; // from frozenTaskSnapshot — only used once closed
  allocations: SprintAllocationData[];
};

function AssigneeSelect({ taskId, projectId, value, roster }: { taskId: string; projectId: string; value: string; roster: RosterPerson[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-[160px]">
      <select
        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await updateTaskProgress(taskId, projectId, { personId: e.target.value || null });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to set assignee.");
            }
          });
        }}
      >
        <option value="">— Unassigned —</option>
        {roster.map((p) => (
          <option key={p.personId} value={p.personId}>
            {p.personName}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

/**
 * Reference-only capacity cross-check ("did they really spend the hours we
 * assumed") — Jira Hours is manually typed in by the PM (no live Jira API),
 * and neither field here ever feeds PV/EV/AV.
 */
function TeamAllocationPanel({
  projectId,
  sprintId,
  allocations,
  roster,
  closed,
  canWrite,
}: {
  projectId: string;
  sprintId: string;
  allocations: SprintAllocationData[];
  roster: RosterPerson[];
  closed: boolean;
  canWrite: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const available = roster.filter((p) => !allocations.some((a) => a.personId === p.personId));
  const editable = canWrite && !closed;

  if (allocations.length === 0 && !editable) return null;

  return (
    <div className="mb-7">
      <SectionHeader
        icon={<IconUsers />}
        iconWrapClass="bg-violet-50 text-violet-600"
        title={
          <>
            Team Allocation <span className="font-normal text-slate-400">(reference only — not part of PV/EV/AV)</span>
          </>
        }
        className="mb-2"
      />
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="py-2.5 px-3">Person</th>
              <th className="py-2.5 px-3 w-36">Allocation %</th>
              <th className="py-2.5 px-3 w-32">Jira Hours</th>
              {editable && <th className="py-2.5 px-3 w-8" />}
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <PersonAvatar name={a.personName} />
                    <span className="text-slate-600">
                      {a.personName}
                      {a.competencyLevel ? ` — ${a.competencyLevel}` : ""}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-3 min-w-[100px]">
                  {editable ? (
                    <InlinePercent value={a.allocationPct} onSave={(v) => updateSprintAllocation(a.id, projectId, { allocationPct: v })} />
                  ) : (
                    <span className="text-slate-600">{Math.round(a.allocationPct * 100)}%</span>
                  )}
                </td>
                <td className="py-2 px-3 min-w-[90px]">
                  {editable ? (
                    <InlineNumber value={a.jiraHours} step={0.5} onSave={(v) => updateSprintAllocation(a.id, projectId, { jiraHours: v })} />
                  ) : (
                    <span className="text-slate-600">{a.jiraHours ?? "—"}</span>
                  )}
                </td>
                {editable && (
                  <td className="py-2 px-3">
                    <RowActionsMenu
                      actions={[
                        {
                          label: "Remove from allocation",
                          pendingLabel: "Removing...",
                          danger: true,
                          onClick: () => deleteSprintAllocation(a.id, projectId),
                        },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {allocations.length === 0 && (
              <tr>
                <td colSpan={editable ? 4 : 3} className="py-3 px-3 text-slate-400">
                  No one allocated to this sprint yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && available.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
          >
            <option value="">Add person…</option>
            {available.map((p) => (
              <option key={p.personId} value={p.personId}>
                {p.personName}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await addSprintAllocation(sprintId, selected, projectId);
                  setSelected("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add person.");
                }
              })
            }
            disabled={pending || !selected}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3.5 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            + Add
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * PV/EV/AV are passed in pre-computed: for an open sprint the caller
 * derives them live (0/100 rule, see sprintEarnedValue), for a closed one
 * they're the permanent frozen* snapshot from the Sprint row — this
 * component never needs to know or care which. Same split for the
 * drill-down: open sprints show `tasks` (live, editable inline); closed
 * sprints show `frozenTasks` (read-only, from frozenTaskSnapshot) so the
 * "which tasks earned this" list can never drift from the frozen totals.
 */
export function SprintSummaryRow({
  projectId,
  sprint,
  roster,
  backlogTasks,
  allProjectTasks,
  canWrite,
  isAdmin,
}: {
  projectId: string;
  sprint: SprintSummaryData;
  roster: RosterPerson[];
  backlogTasks: BacklogTaskOption[];
  allProjectTasks: { id: string; wbsNumber: string; title: string }[];
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Same duplicate-title detection as the Tasks tab, against every task in
  // the project (not just this sprint's own) — a title edited here can
  // collide with a task sitting in the backlog or another sprint just as
  // easily as one in the Tasks tab.
  const duplicateWbsByTaskId = useMemo(() => computeDuplicateRefs(allProjectTasks), [allProjectTasks]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedBacklogId, setSelectedBacklogId] = useState("");
  const [importPending, startImportTransition] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);

  const cpi = competencyCpi(sprint.ev, sprint.av);
  const spi = sprint.pv ? sprint.ev / sprint.pv : null;
  const closed = !!sprint.closedAt;
  const editable = canWrite && !closed;
  const taskColCount = closed ? 5 : editable ? 8 : 7;

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 cursor-pointer hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${closed ? "bg-slate-400" : "bg-emerald-500"}`} />
          <span className="text-sm font-semibold text-slate-800">{sprint.name}</span>
          <span className="text-xs text-slate-400">
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </span>
          {closed ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Closed</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>PV {sprint.pv.toFixed(1)}</span>
          <span>EV {sprint.ev.toFixed(1)}</span>
          <span>AV {sprint.av.toFixed(1)}</span>
          <span className="flex items-center gap-1">
            SPI <IndexValue value={spi} />
          </span>
          <span className="flex items-center gap-1">
            CPI <IndexValue value={cpi} />
          </span>
          <span className="text-slate-400">›</span>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[88vh] overflow-y-auto p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${closed ? "bg-slate-400" : "bg-emerald-500"}`} />
                  <h3 className="text-xl font-bold text-slate-900">{sprint.name}</h3>
                  {closed ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Closed</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7">
              <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="PV" value={sprint.pv.toFixed(1)} />
              <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" label="EV" value={sprint.ev.toFixed(1)} />
              <StatTile icon={<IconClock />} iconWrapClass="bg-amber-50 text-amber-600" label="AV" value={sprint.av.toFixed(1)} />
              <StatTile
                icon={<IconChart />}
                iconWrapClass="bg-violet-50 text-violet-600"
                label="SPI"
                value={spi == null ? "—" : spi.toFixed(2)}
                valueColor={spi == null ? undefined : INDEX_BAND_COLORS[indexBand(spi)].text}
              />
              <StatTile
                icon={<IconChart />}
                iconWrapClass="bg-indigo-50 text-indigo-600"
                label="CPI"
                value={cpi == null ? "—" : cpi.toFixed(2)}
                valueColor={cpi == null ? undefined : INDEX_BAND_COLORS[indexBand(cpi)].text}
              />
            </div>

            <div className="mb-7">
              <SectionHeader icon={<IconClipboardList />} iconWrapClass="bg-blue-50 text-blue-600" title="Tasks" className="mb-2" />
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="py-2.5 px-3 w-24">WBS#</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3 w-28">Story Pts</th>
                      <th className="py-2.5 px-3 w-28">% Complete</th>
                      {!closed && <th className="py-2.5 px-3 w-32">Actual Hrs</th>}
                      {!closed && <th className="py-2.5 px-3 w-44">Assignee</th>}
                      <th className="py-2.5 px-3 w-28">Status</th>
                      {editable && <th className="py-2.5 px-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {closed
                      ? sprint.frozenTasks.map((t) => (
                          <tr key={t.taskId} className="border-t border-slate-100">
                            <td className="py-2 px-3 text-slate-600">{t.wbsNumber || "—"}</td>
                            <td className="py-2 px-3 text-slate-600">{t.title}</td>
                            <td className="py-2 px-3 text-slate-500">{t.storyPoints}</td>
                            <td className="py-2 px-3 text-slate-500">{Math.round(t.pctComplete * 100)}%</td>
                            <td className="py-2 px-3">
                              <StatusPill pctComplete={t.pctComplete} />
                            </td>
                          </tr>
                        ))
                      : sprint.tasks.map((t) => (
                          <tr key={t.id} className="border-t border-slate-100">
                            <td className="py-2 px-3">
                              {editable ? (
                                <InlineText value={t.wbsNumber} onSave={(v) => updateWbsTask(t.id, projectId, { wbsNumber: v })} />
                              ) : (
                                <span className="text-slate-600">{t.wbsNumber || "—"}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="min-w-0 flex-1">
                                  {editable ? (
                                    <InlineText value={t.title} onSave={(v) => updateWbsTask(t.id, projectId, { title: v })} />
                                  ) : (
                                    <span className="text-slate-600">{t.title}</span>
                                  )}
                                </div>
                                {duplicateWbsByTaskId.has(t.id) && (
                                  <DuplicateBadge
                                    projectId={projectId}
                                    taskId={t.id}
                                    otherRefs={duplicateWbsByTaskId.get(t.id)!}
                                    canWrite={editable}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 min-w-[80px]">
                              {editable ? (
                                <InlineNumber value={t.storyPoints} step={1} onSave={(v) => updateWbsTask(t.id, projectId, { storyPoints: v ?? 0 })} />
                              ) : (
                                <span className="text-slate-500">{t.storyPoints}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 min-w-[100px]">
                              {editable ? (
                                <InlinePercent value={t.pctComplete} onSave={(v) => updateTaskProgress(t.id, projectId, { pctComplete: v })} />
                              ) : (
                                <span className="text-slate-600">{Math.round(t.pctComplete * 100)}%</span>
                              )}
                            </td>
                            <td className="py-2 px-3 min-w-[90px]">
                              {editable ? (
                                <InlineNumber value={t.actualHours} step={0.5} onSave={(v) => updateTaskProgress(t.id, projectId, { actualHours: v ?? 0 })} />
                              ) : (
                                <span className="text-slate-600">{t.actualHours}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <PersonAvatar name={t.personName} />
                                {editable ? (
                                  <AssigneeSelect taskId={t.id} projectId={projectId} value={t.personId ?? ""} roster={roster} />
                                ) : (
                                  <span className="text-slate-600">{t.personName ?? "—"}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <StatusPill pctComplete={t.pctComplete} />
                            </td>
                            {editable && (
                              <td className="py-2 px-3">
                                <RowActionsMenu
                                  actions={[
                                    {
                                      label: "Remove from sprint",
                                      pendingLabel: "Removing...",
                                      danger: true,
                                      onClick: () => assignTaskToSprint(t.id, null, projectId),
                                    },
                                  ]}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                    {(closed ? sprint.frozenTasks.length : sprint.tasks.length) === 0 && (
                      <tr>
                        <td colSpan={taskColCount} className="py-3 px-3 text-slate-400">
                          No tasks committed to this sprint {closed ? "when it closed" : "yet — add one below"}.
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-200 font-medium text-slate-700">
                      <td className="py-2 px-3" colSpan={taskColCount - 1}>
                        Grand Total (Earned Value)
                      </td>
                      <td className="py-2 px-3">{sprint.ev.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {editable && (
                <div className="mt-3">
                  {backlogTasks.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        value={selectedBacklogId}
                        onChange={(e) => setSelectedBacklogId(e.target.value)}
                        disabled={importPending}
                      >
                        <option value="">Import from backlog…</option>
                        {backlogTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {duplicateWbsByTaskId.has(t.id) ? "⚠ " : ""}
                            {t.wbsNumber ? `${t.wbsNumber} — ` : ""}
                            {t.title} ({t.storyPoints} pts)
                            {duplicateWbsByTaskId.has(t.id) ? ` — dup of WBS ${duplicateWbsByTaskId.get(t.id)!.join(", ")}` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          startImportTransition(async () => {
                            setImportError(null);
                            try {
                              await assignTaskToSprint(selectedBacklogId, sprint.id, projectId);
                              setSelectedBacklogId("");
                            } catch (err) {
                              setImportError(err instanceof Error ? err.message : "Failed to add task to sprint.");
                            }
                          })
                        }
                        disabled={importPending || !selectedBacklogId}
                        className="rounded-md bg-slate-900 text-white text-sm font-medium px-3.5 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                      >
                        {importPending ? "Adding..." : "+ Add"}
                      </button>
                      {importError && <span className="text-xs text-red-600">{importError}</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No unassigned backlog tasks — define a new one on the Tasks tab.</p>
                  )}
                </div>
              )}
            </div>

            <TeamAllocationPanel
              projectId={projectId}
              sprintId={sprint.id}
              allocations={sprint.allocations}
              roster={roster}
              closed={closed}
              canWrite={canWrite}
            />

            {canWrite && !closed && (
              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      if (!window.confirm(`Close "${sprint.name}"? This freezes its PV/EV/AV permanently and can't be undone.`)) return;
                      try {
                        await closeSprint(sprint.id, projectId);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to close sprint.");
                      }
                    })
                  }
                  disabled={pending}
                  className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
                >
                  {pending ? "Closing..." : "Close Sprint"}
                </button>
                {error && <span className="text-xs text-red-600">{error}</span>}
              </div>
            )}

            {isAdmin && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">
                  Admin — emergency edit / reorganize{closed ? " (overrides the closed lock)" : ""}
                </h4>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Name</label>
                    <InlineText value={sprint.name} onSave={(v) => updateSprint(sprint.id, projectId, { name: v })} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Start</label>
                    <InlineDate
                      value={toDateInputValue(sprint.startDate)}
                      onSave={(v) => updateSprint(sprint.id, projectId, { startDate: v ?? undefined })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">End</label>
                    <InlineDate
                      value={toDateInputValue(sprint.endDate)}
                      onSave={(v) => updateSprint(sprint.id, projectId, { endDate: v ?? undefined })}
                    />
                  </div>
                  <button
                    onClick={() =>
                      startDeleteTransition(async () => {
                        setDeleteError(null);
                        if (!window.confirm(`Delete sprint "${sprint.name}"? This can't be undone, and the sprint must have no committed tasks.`)) return;
                        try {
                          await deleteSprint(sprint.id, projectId);
                        } catch (err) {
                          setDeleteError(err instanceof Error ? err.message : "Failed to delete sprint.");
                        }
                      })
                    }
                    disabled={deletePending}
                    className="rounded-md border border-red-300 text-red-700 text-sm font-medium px-3.5 py-1.5 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletePending ? "Deleting..." : "Delete Sprint"}
                  </button>
                </div>
                {deleteError && <p className="mt-1.5 text-xs text-red-600">{deleteError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
