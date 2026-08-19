"use client";

import { useState, useTransition } from "react";
import { normalizeTaskTitle } from "@/lib/format";
import { deleteWbsTask } from "./delivery-actions";

/**
 * Groups tasks by normalized title and returns, for each task that shares
 * its title with at least one other task, the list of "other" WBS# refs it
 * collides with. Plain function (not a Hook) so callers can memoize it
 * themselves — used identically by the Tasks tab and the Sprint popup's own
 * committed-tasks table, so a title edited in either place gets the same
 * signal.
 */
export function computeDuplicateRefs<T extends { id: string; title: string; wbsNumber: string }>(
  tasks: T[]
): Map<string, string[]> {
  const byTitle = new Map<string, T[]>();
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
        group.filter((o) => o.id !== t.id).map((o) => o.wbsNumber || "unnumbered")
      );
    }
  }
  return result;
}

/**
 * Non-blocking duplicate flag. Clicking it opens a small inline confirm to
 * delete *this* task right away, since the point of flagging a duplicate is
 * to make it easy to resolve, not just visible.
 */
export function DuplicateBadge({
  projectId,
  taskId,
  otherRefs,
  canWrite,
}: {
  projectId: string;
  taskId: string;
  otherRefs: string[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Possible duplicate — same title as WBS ${otherRefs.join(", ")}`}
        className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
      >
        ⚠ dup?
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
          <p className="text-slate-600">Same title as WBS {otherRefs.join(", ")}.</p>
          {error && <p className="mt-1 text-red-600">{error}</p>}
          <div className="mt-2 flex items-center gap-2">
            {canWrite && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await deleteWbsTask(taskId, projectId);
                      setOpen(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to delete task.");
                    }
                  })
                }
                className="rounded bg-red-600 px-2 py-1 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete this task"}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
