"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineNumber } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconSearch, IconUpload, IconSort, IconClock } from "@/components/layout/icons";
import { AuditLogTable, type AuditLogRow } from "@/components/rbac/audit-log-table";
import { STATUS_COLORS } from "@/lib/colors";
import { avatarColorFromString } from "@/lib/colors";
import { initials, compareWbsNumbers } from "@/lib/format";
import { computeDuplicateRefs, DuplicateBadge } from "./duplicate-badge";
import { createWbsTask, updateWbsTask, deleteWbsTask, assignTaskToSprint } from "./delivery-actions";

export type WbsTaskData = {
  id: string;
  wbsNumber: string;
  title: string;
  storyPoints: number;
  pctComplete: number;
  actualHours: number;
  personId: string | null;
  personName: string | null;
  sprintId: string | null;
};
export type RosterPerson = { personId: string; personName: string; competencyLevel: string | null };
export type SprintOption = { id: string; name: string; closedAt: Date | null };

const PAGE_SIZES = [10, 25, 50] as const;
type SortKey = "wbsNumber" | "storyPoints" | "done" | "remaining";

// Committing a task to a sprint or logging hours against it is evidence
// someone has started the work, even before pctComplete is nudged up — so
// those flip the status out of Not Started the same way a nonzero
// pctComplete does.
function taskStatusKey(t: Pick<WbsTaskData, "pctComplete" | "actualHours" | "sprintId">): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" {
  if (t.pctComplete >= 1) return "COMPLETED";
  if (t.pctComplete > 0 || t.actualHours > 0 || t.sprintId) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function SortHeader({ label, sortKey, active, dir, onClick, className }: { label: string; sortKey: SortKey; active: boolean; dir: "asc" | "desc"; onClick: (k: SortKey) => void; className?: string }) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={clsx("inline-flex items-center gap-1 hover:text-slate-700", active && "text-slate-800")}
      >
        {label}
        <IconSort className={clsx("h-3 w-3 shrink-0", active ? "text-slate-600" : "text-slate-300", active && dir === "desc" && "rotate-180")} />
      </button>
    </th>
  );
}

function PersonSelect({ rowId, projectId, value, roster }: { rowId: string; projectId: string; value: string; roster: RosterPerson[] }) {
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

function AddTaskModal({ onSubmit, onClose, pending }: { onSubmit: (data: { wbsNumber: string; title: string; storyPoints: number }) => void; onClose: () => void; pending: boolean }) {
  const [wbsNumber, setWbsNumber] = useState("");
  const [title, setTitle] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-900">Add task</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError("A title is required.");
              return;
            }
            setError(null);
            onSubmit({ wbsNumber: wbsNumber.trim(), title: title.trim(), storyPoints: storyPoints === "" ? 0 : Number(storyPoints) });
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">WBS#</label>
              <input
                type="text"
                value={wbsNumber}
                onChange={(e) => setWbsNumber(e.target.value)}
                placeholder="e.g. 14.11.4"
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Story Points</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
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
  duplicateCheckTasks,
  roster,
  sprints,
  canWrite,
  showAddRow = true,
  emptyMessage = "No WBS tasks yet.",
  taskHistory,
  uploadForm,
}: {
  projectId: string;
  tasks: WbsTaskData[];
  /** Defaults to `tasks`. Pass the full project list when `tasks` is a
   * filtered subset (e.g. the Completed-only table) so duplicate detection
   * still catches a title colliding with a task outside this subset. */
  duplicateCheckTasks?: WbsTaskData[];
  roster: RosterPerson[];
  sprints: SprintOption[];
  canWrite: boolean;
  showAddRow?: boolean;
  emptyMessage?: string;
  taskHistory?: Record<string, AuditLogRow[]>;
  /** Rendered inline (toggled via "Import Tasks") — only meaningful when showAddRow. */
  uploadForm?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  // Duplicate-title detection, computed client-side from the already-loaded
  // task list — no extra round-trip needed. Non-blocking: a matching title
  // just gets flagged (with the other WBS#s it collides with) so the PM can
  // decide whether to merge/rename/delete, rather than silently allowing
  // the same work item to exist twice (which is exactly how real duplicates
  // piled up here before this existed). Computed before the early return
  // below so this Hook always runs in the same order.
  const duplicateWbsByTaskId = useMemo(() => computeDuplicateRefs(duplicateCheckTasks ?? tasks), [duplicateCheckTasks, tasks]);

  // Filtering/sorting/paging computed before the early return below so the
  // jump-to-new-task effect (which needs the sorted+paged position) always
  // runs in the same Hook order regardless of that branch.
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

  const sortedTasks = sort
    ? [...filteredTasks].sort((a, b) => {
        let cmp = 0;
        if (sort.key === "wbsNumber") cmp = compareWbsNumbers(a.wbsNumber, b.wbsNumber);
        else if (sort.key === "storyPoints") cmp = a.storyPoints - b.storyPoints;
        else if (sort.key === "done") cmp = a.storyPoints * a.pctComplete - b.storyPoints * b.pctComplete;
        else cmp = a.storyPoints * (1 - a.pctComplete) - b.storyPoints * (1 - b.pctComplete);
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : filteredTasks;

  const pageCount = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageTasks = sortedTasks.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  // After adding a task via the modal, jump to whichever page it actually
  // landed on (position depends on current sort) instead of leaving the PM
  // on the page they were viewing, where a task appended at the end of an
  // unsorted list would otherwise be invisible.
  useEffect(() => {
    if (!pendingFocusId) return;
    const idx = sortedTasks.findIndex((t) => t.id === pendingFocusId);
    if (idx === -1) return;
    setPage(Math.floor(idx / pageSize) + 1);
    setPendingFocusId(null);
  }, [sortedTasks, pendingFocusId, pageSize]);

  if (tasks.length === 0 && !(canWrite && showAddRow)) {
    return <p className="text-sm text-slate-400 p-4">{emptyMessage}</p>;
  }

  const historyTask = historyTaskId ? tasks.find((t) => t.id === historyTaskId) : undefined;

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  const colCount = 8 + (taskHistory ? 1 : 0) + (canWrite ? 1 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title or WBS#…"
              className="w-48 rounded border border-slate-200 pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <select
            value={sprintFilter}
            onChange={(e) => {
              setSprintFilter(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              setPage(1);
            }}
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
                setPage(1);
              }}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
          {canWrite && showAddRow && (
            <div className="ml-auto flex items-center gap-2">
              {uploadForm && (
                <button
                  type="button"
                  onClick={() => setShowImport((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
                >
                  <IconUpload className="h-3.5 w-3.5" />
                  Import Tasks
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAddTask(true)}
                disabled={pending}
                className="rounded-md bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
              >
                + Add Task
              </button>
            </div>
          )}
        </div>
      )}

      {showImport && uploadForm && <div className="border-b border-slate-100 bg-white px-4 py-3">{uploadForm}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">
              <SortHeader label="WBS#" sortKey="wbsNumber" active={sort?.key === "wbsNumber"} dir={sort?.dir ?? "asc"} onClick={toggleSort} className="px-4 py-3 w-24" />
              <th className="px-4 py-3">Title</th>
              <SortHeader label="Story Pts" sortKey="storyPoints" active={sort?.key === "storyPoints"} dir={sort?.dir ?? "asc"} onClick={toggleSort} className="px-4 py-3 w-24" />
              <SortHeader label="Done" sortKey="done" active={sort?.key === "done"} dir={sort?.dir ?? "asc"} onClick={toggleSort} className="px-4 py-3 w-24" />
              <SortHeader label="Remaining" sortKey="remaining" active={sort?.key === "remaining"} dir={sort?.dir ?? "asc"} onClick={toggleSort} className="px-4 py-3 w-28" />
              <th className="px-4 py-3 w-52">Default Assignee</th>
              <th className="px-4 py-3 w-40">Sprint</th>
              <th className="px-4 py-3 w-28">Status</th>
              {taskHistory && <th className="px-4 py-3 w-10" />}
              {canWrite && <th className="px-4 py-3 w-16">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageTasks.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-sm text-slate-400">
                  {tasks.length === 0 ? emptyMessage : "No tasks match the current filters."}
                </td>
              </tr>
            )}
            {pageTasks.map((t) => {
              const donePts = t.storyPoints * t.pctComplete;
              const remainingPts = t.storyPoints - donePts;
              const status = STATUS_COLORS[taskStatusKey(t)];
              const assigneeRoster = roster.find((p) => p.personId === t.personId);
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
                      <DuplicateBadge
                        projectId={projectId}
                        taskId={t.id}
                        otherRefs={duplicateWbsByTaskId.get(t.id)!}
                        canWrite={canWrite}
                      />
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
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: avatarColorFromString(t.personName ?? "?") }}
                    >
                      {initials(t.personName ?? "?")}
                    </span>
                    <div className="min-w-0 flex-1">
                      {canWrite ? (
                        <PersonSelect rowId={t.id} projectId={projectId} value={t.personId ?? ""} roster={roster} />
                      ) : (
                        <span className="text-slate-600 truncate block">{t.personName ?? "—"}</span>
                      )}
                      {assigneeRoster?.competencyLevel && (
                        <span className="text-[11px] text-slate-400 block leading-tight">{assigneeRoster.competencyLevel}</span>
                      )}
                    </div>
                  </div>
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
                <td className="px-4 py-2">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                    style={{ backgroundColor: status.bg, color: status.text }}
                  >
                    {status.label}
                  </span>
                </td>
                {taskHistory && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setHistoryTaskId(t.id)}
                      title="View history"
                      className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <IconClock className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
                {canWrite && (
                  <td className="px-4 py-2">
                    <RowActionsMenu
                      actions={[
                        {
                          label: "Delete task",
                          pendingLabel: "Deleting...",
                          danger: true,
                          onClick: () => deleteWbsTask(t.id, projectId),
                        },
                      ]}
                    />
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedTasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, sortedTasks.length)} of {sortedTasks.length} tasks
          </span>
          {sortedTasks.length > PAGE_SIZES[0] && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                  disabled={clampedPage <= 1}
                  className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={clsx("min-w-[1.75rem] rounded-md px-2 py-1", n === clampedPage ? "bg-indigo-600 text-white" : "border border-slate-200 hover:bg-slate-50")}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                  disabled={clampedPage >= pageCount}
                  className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                  setPage(1);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {showAddTask && (
        <AddTaskModal
          pending={pending}
          onClose={() => setShowAddTask(false)}
          onSubmit={(data) => {
            setSearch("");
            setSprintFilter("all");
            setAssigneeFilter("all");
            startTransition(async () => {
              const created = await createWbsTask(projectId, data);
              setPendingFocusId(created.id);
              setShowAddTask(false);
            });
          }}
        />
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
