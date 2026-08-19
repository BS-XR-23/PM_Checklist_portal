"use client";

import { useMemo, useState, useTransition } from "react";
import { InlineText, InlineNumber } from "@/components/ui/inline-edit";
import { AuditLogTable, type AuditLogRow } from "@/components/rbac/audit-log-table";
import { normalizeTaskTitle } from "@/lib/format";
import { createWbsTask, updateWbsTask, deleteWbsTask, assignTaskToSprint } from "./delivery-actions";

export type WbsTaskData = {
  id: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
  personId: string | null;
  personName: string | null;
  sprintId: string | null;
};
export type RosterPerson = { personId: string; personName: string; competencyLevel: string | null };
export type SprintOption = { id: string; name: string; closedAt: Date | null };

function PersonSelect({ rowId, projectId, value, roster }: { rowId: string; projectId: string; value: string; roster: RosterPerson[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-[180px]">
      <select
        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await updateWbsTask(rowId, projectId, { personId: e.target.value || null });
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
            {p.competencyLevel ? ` — ${p.competencyLevel}` : ""}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

function SprintSelect({ taskId, projectId, value, sprints }: { taskId: string; projectId: string; value: string; sprints: SprintOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-[140px]">
      <select
        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await assignTaskToSprint(taskId, e.target.value || null, projectId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to commit task to sprint.");
            }
          });
        }}
      >
        <option value="">— None —</option>
        {sprints.map((s) => (
          <option key={s.id} value={s.id} disabled={!!s.closedAt}>
            {s.name}
            {s.closedAt ? " (closed)" : ""}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

/** The project-wide WBS master list (Tasks tab) — no week grouping. Story
 * Points is the estimate, driving Sprint's PV and 0/100 EV rule directly;
 * assignee here is the default a task starts with, overridable once it's
 * committed to a sprint and being tracked. Closed sprints still appear in
 * the Sprint dropdown (disabled) so a task already committed to one
 * displays correctly — assignTaskToSprint rejects committing into a closed
 * sprint, since its numbers are already frozen, but a task can still be
 * moved out of one to None or another open sprint. */
export function WbsTasksTable({
  projectId,
  tasks,
  roster,
  sprints,
  canWrite,
  taskHistory,
}: {
  projectId: string;
  tasks: WbsTaskData[];
  roster: RosterPerson[];
  sprints: SprintOption[];
  canWrite: boolean;
  taskHistory?: Record<string, AuditLogRow[]>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Duplicate-title detection, computed client-side from the already-loaded
  // task list — no extra round-trip needed. Non-blocking: a matching title
  // just gets flagged (with the other WBS#s it collides with) so the PM can
  // decide whether to merge/rename/delete, rather than silently allowing
  // the same work item to exist twice (which is exactly how real duplicates
  // piled up here before this existed). Computed before the early return
  // below so this Hook always runs in the same order.
  const duplicateWbsByTaskId = useMemo(() => {
    const byTitle = new Map<string, WbsTaskData[]>();
    for (const t of tasks) {
      if (!t.title.trim()) continue;
      const key = normalizeTaskTitle(t.title);
      const group = byTitle.get(key) ?? [];
      group.push(t);
      byTitle.set(key, group);
    }
    const result = new Map<string, string[]>();
    for (const group of Array.from(byTitle.values())) {
      if (group.length < 2) continue;
      for (const t of group) {
        result.set(
          t.id,
          group.filter((o: WbsTaskData) => o.id !== t.id).map((o: WbsTaskData) => o.wbsNumber || "unnumbered")
        );
      }
    }
    return result;
  }, [tasks]);

  if (tasks.length === 0 && !canWrite) {
    return <p className="text-sm text-slate-400 p-4">No WBS tasks yet.</p>;
  }

  const historyTask = historyTaskId ? tasks.find((t) => t.id === historyTaskId) : undefined;

  const q = search.trim().toLowerCase();
  const filteredTasks = tasks.filter((t) => {
    if (sprintFilter === "backlog" && t.sprintId) return false;
    if (sprintFilter !== "all" && sprintFilter !== "backlog" && t.sprintId !== sprintFilter) return false;
    if (assigneeFilter === "unassigned" && t.personId) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && t.personId !== assigneeFilter) return false;
    if (q && !t.title.toLowerCase().includes(q) && !t.wbsNumber.toLowerCase().includes(q)) return false;
    return true;
  });
  const filtersActive = sprintFilter !== "all" || assigneeFilter !== "all" || q !== "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or WBS#…"
            className="w-48 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="all">All sprints</option>
            <option value="backlog">Backlog (unassigned)</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {roster.map((p) => (
              <option key={p.personId} value={p.personId}>
                {p.personName}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              onClick={() => {
                setSearch("");
                setSprintFilter("all");
                setAssigneeFilter("all");
              }}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filteredTasks.length === tasks.length ? `${tasks.length} tasks` : `${filteredTasks.length} of ${tasks.length} tasks`}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 w-24">WBS#</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 w-24">Story Pts</th>
              <th className="px-4 py-3 w-24" title="Informational only — pctComplete × Story Pts. Actual PV/EV/AV always use the 0/100 rule (see Sprints tab).">
                Done
              </th>
              <th className="px-4 py-3 w-28" title="Informational only — Story Pts minus Done. Actual PV/EV/AV always use the 0/100 rule (see Sprints tab).">
                Remaining
              </th>
              <th className="px-4 py-3 w-52">Default Assignee</th>
              <th className="px-4 py-3 w-40">Sprint</th>
              {taskHistory && <th className="px-4 py-3 w-10" />}
              {canWrite && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                  No tasks match the current filters.
                </td>
              </tr>
            )}
            {filteredTasks.map((t) => {
              const donePts = t.storyPoints * t.pctComplete;
              const remainingPts = t.storyPoints - donePts;
              return (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineText value={t.wbsNumber} onSave={(v) => updateWbsTask(t.id, projectId, { wbsNumber: v })} />
                  ) : (
                    <span className="text-slate-600">{t.wbsNumber || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      {canWrite ? (
                        <InlineText value={t.title} onSave={(v) => updateWbsTask(t.id, projectId, { title: v })} />
                      ) : (
                        <span className="text-slate-600">{t.title}</span>
                      )}
                    </div>
                    {duplicateWbsByTaskId.has(t.id) && (
                      <span
                        title={`Possible duplicate — same title as WBS ${duplicateWbsByTaskId.get(t.id)!.join(", ")}`}
                        className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                      >
                        ⚠ dup?
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineNumber value={t.storyPoints} step={1} onSave={(v) => updateWbsTask(t.id, projectId, { storyPoints: v ?? 0 })} />
                  ) : (
                    <span className="text-slate-600">{t.storyPoints}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-emerald-700">{donePts.toFixed(2)}</td>
                <td className="px-4 py-2 text-slate-500">{remainingPts.toFixed(2)}</td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <PersonSelect rowId={t.id} projectId={projectId} value={t.personId ?? ""} roster={roster} />
                  ) : (
                    <span className="text-slate-600">{t.personName ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <SprintSelect taskId={t.id} projectId={projectId} value={t.sprintId ?? ""} sprints={sprints} />
                  ) : (
                    <span className="text-slate-600">
                      {t.sprintId ? sprints.find((s) => s.id === t.sprintId)?.name ?? "—" : "—"}
                    </span>
                  )}
                </td>
                {taskHistory && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setHistoryTaskId(t.id)}
                      title="View history"
                      className="text-slate-300 hover:text-slate-700"
                    >
                      🕘
                    </button>
                  </td>
                )}
                {canWrite && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          setError(null);
                          try {
                            await deleteWbsTask(t.id, projectId);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to delete task.");
                          }
                        })
                      }
                      disabled={pending}
                      title="Delete task"
                      className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-600 px-4 py-2">{error}</p>}

      {canWrite && (
        <button
          onClick={() => startTransition(() => createWbsTask(projectId))}
          disabled={pending}
          className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-50 border-t border-slate-100"
        >
          + Add row
        </button>
      )}

      {historyTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">History</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {historyTask.wbsNumber ? `${historyTask.wbsNumber} — ` : ""}
                  {historyTask.title}
                </p>
              </div>
              <button
                onClick={() => setHistoryTaskId(null)}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <AuditLogTable rows={taskHistory?.[historyTask.id] ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
