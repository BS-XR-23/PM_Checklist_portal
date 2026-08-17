"use client";

import { useState, useTransition } from "react";
import { formatDate, toDateInputValue } from "@/lib/format";
import { competencyCpi } from "@/lib/calculations";
import { INDEX_FAVORABLE_COLOR, INDEX_UNFAVORABLE_COLOR } from "@/lib/colors";
import { InlinePercent, InlineNumber, InlineText, InlineDate } from "@/components/ui/inline-edit";
import {
  closeSprint,
  updateSprint,
  deleteSprint,
  updateWbsTask,
  createWbsTaskInSprint,
  assignTaskToSprint,
  updateTaskProgress,
  addSprintAllocation,
  updateSprintAllocation,
  deleteSprintAllocation,
} from "./delivery-actions";
import type { RosterPerson } from "./delivery-tasks-table";

function IndexValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  const favorable = value >= 1;
  const color = favorable ? INDEX_FAVORABLE_COLOR : INDEX_UNFAVORABLE_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold"
      style={{ backgroundColor: favorable ? "#E6F4EC" : "#FBE9E9", color }}
    >
      {value.toFixed(2)}
    </span>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-800">{children}</div>
    </div>
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
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-slate-600 mb-1">Team Allocation (reference only — not part of PV/EV/AV)</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="font-medium py-1 pr-2">Person</th>
            <th className="font-medium py-1 pr-2 w-24">Allocation</th>
            <th className="font-medium py-1 pr-2 w-24">Jira Hours</th>
            {editable && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2 text-slate-600">
                {a.personName}
                {a.competencyLevel ? ` — ${a.competencyLevel}` : ""}
              </td>
              <td className="py-1.5 pr-2">
                {editable ? (
                  <InlinePercent value={a.allocationPct} onSave={(v) => updateSprintAllocation(a.id, projectId, { allocationPct: v })} />
                ) : (
                  <span className="text-slate-600">{Math.round(a.allocationPct * 100)}%</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {editable ? (
                  <InlineNumber value={a.jiraHours} step={0.5} onSave={(v) => updateSprintAllocation(a.id, projectId, { jiraHours: v })} />
                ) : (
                  <span className="text-slate-600">{a.jiraHours ?? "—"}</span>
                )}
              </td>
              {editable && (
                <td className="py-1.5">
                  <button
                    onClick={() => startTransition(() => deleteSprintAllocation(a.id, projectId))}
                    disabled={pending}
                    title="Remove from allocation"
                    className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
          {allocations.length === 0 && (
            <tr>
              <td colSpan={editable ? 4 : 3} className="py-2 text-slate-400">
                No one allocated to this sprint yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editable && available.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <select
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
            className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
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
  canWrite,
  isAdmin,
}: {
  projectId: string;
  sprint: SprintSummaryData;
  roster: RosterPerson[];
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [addTaskPending, startAddTaskTransition] = useTransition();
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [removePendingId, setRemovePendingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();

  const cpi = competencyCpi(sprint.ev, sprint.av);
  const spi = sprint.pv ? sprint.ev / sprint.pv : null;
  const closed = !!sprint.closedAt;
  const editable = canWrite && !closed;
  const taskColCount = closed ? 5 : editable ? 8 : 7;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-800">{sprint.name}</span>
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
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[88vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{sprint.name}</h3>
                  {closed ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Closed</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
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

            <div className="grid grid-cols-5 gap-2 mb-6">
              <StatCard label="PV">{sprint.pv.toFixed(1)}</StatCard>
              <StatCard label="EV">{sprint.ev.toFixed(1)}</StatCard>
              <StatCard label="AV">{sprint.av.toFixed(1)}</StatCard>
              <StatCard label="SPI">
                <IndexValue value={spi} />
              </StatCard>
              <StatCard label="CPI">
                <IndexValue value={cpi} />
              </StatCard>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Tasks</h4>
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3 w-20">WBS#</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3 w-24">Story Pts</th>
                      <th className="py-2.5 px-3 w-20">%</th>
                      {!closed && <th className="py-2.5 px-3 w-28">Actual Hrs</th>}
                      {!closed && <th className="py-2.5 px-3 w-44">Assignee</th>}
                      <th className="py-2.5 px-3 w-16">Done</th>
                      {editable && <th className="py-2.5 px-3 w-8" />}
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
                              {t.pctComplete >= 1 ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-slate-300">—</span>}
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
                              {editable ? (
                                <InlineText value={t.title} onSave={(v) => updateWbsTask(t.id, projectId, { title: v })} />
                              ) : (
                                <span className="text-slate-600">{t.title}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {editable ? (
                                <InlineNumber value={t.storyPoints} step={1} onSave={(v) => updateWbsTask(t.id, projectId, { storyPoints: v ?? 0 })} />
                              ) : (
                                <span className="text-slate-500">{t.storyPoints}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {editable ? (
                                <InlinePercent value={t.pctComplete} onSave={(v) => updateTaskProgress(t.id, projectId, { pctComplete: v })} />
                              ) : (
                                <span className="text-slate-600">{Math.round(t.pctComplete * 100)}%</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {editable ? (
                                <InlineNumber value={t.actualHours} step={0.5} onSave={(v) => updateTaskProgress(t.id, projectId, { actualHours: v ?? 0 })} />
                              ) : (
                                <span className="text-slate-600">{t.actualHours}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {editable ? (
                                <AssigneeSelect taskId={t.id} projectId={projectId} value={t.personId ?? ""} roster={roster} />
                              ) : (
                                <span className="text-slate-600">{t.personName ?? "—"}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {t.pctComplete >= 1 ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-slate-300">—</span>}
                            </td>
                            {editable && (
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => {
                                    setRemoveError(null);
                                    setRemovePendingId(t.id);
                                    startRemoveTransition(async () => {
                                      try {
                                        await assignTaskToSprint(t.id, null, projectId);
                                      } catch (err) {
                                        setRemoveError(err instanceof Error ? err.message : "Failed to remove task from sprint.");
                                      } finally {
                                        setRemovePendingId(null);
                                      }
                                    });
                                  }}
                                  disabled={removePendingId === t.id}
                                  title="Remove from sprint"
                                  className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                                >
                                  ✕
                                </button>
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
              {removeError && <p className="mt-1.5 text-xs text-red-600">{removeError}</p>}
              {editable && (
                <div className="mt-2">
                  <button
                    onClick={() =>
                      startAddTaskTransition(async () => {
                        setAddTaskError(null);
                        try {
                          await createWbsTaskInSprint(sprint.id, projectId);
                        } catch (err) {
                          setAddTaskError(err instanceof Error ? err.message : "Failed to add task.");
                        }
                      })
                    }
                    disabled={addTaskPending}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  >
                    {addTaskPending ? "Adding..." : "+ Add Task"}
                  </button>
                  {addTaskError && <span className="ml-2 text-xs text-red-600">{addTaskError}</span>}
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
              <div className="mt-4 flex items-center gap-2">
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
                  className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  {pending ? "Closing..." : "Close Sprint"}
                </button>
                {error && <span className="text-xs text-red-600">{error}</span>}
              </div>
            )}

            {isAdmin && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                <h4 className="text-xs font-semibold text-amber-800 mb-2">
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
                    className="rounded-md border border-red-300 text-red-700 text-xs font-medium px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
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
