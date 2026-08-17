"use client";

import { useState, useTransition } from "react";
import { InlineText, InlineNumber } from "@/components/ui/inline-edit";
import { createWbsTask, updateWbsTask, deleteWbsTask, assignTaskToSprint } from "./delivery-actions";

export type WbsTaskData = {
  id: string;
  wbsNumber: string;
  title: string;
  manDays: number;
  storyPoints: number | null;
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

/** The project-wide WBS master list (Tasks tab) — no week grouping. Man-days
 * is the estimate; assignee here is just the default a new week's entry
 * starts from, editable independently per week on the Weekly Tracking tab.
 * Story Points is a display/velocity figure only — man-days is what drives
 * PV/EV/AV/CPI everywhere, including Sprint Summary. Closed sprints still
 * appear in the dropdown (disabled) so a task already committed to one
 * displays correctly — assignTaskToSprint rejects committing into a closed
 * sprint, since its numbers are already frozen, but a task can still be
 * moved out of one to None or another open sprint. */
export function WbsTasksTable({
  projectId,
  tasks,
  roster,
  sprints,
  canWrite,
}: {
  projectId: string;
  tasks: WbsTaskData[];
  roster: RosterPerson[];
  sprints: SprintOption[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tasks.length === 0 && !canWrite) {
    return <p className="text-sm text-slate-400 p-4">No WBS tasks yet.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-medium w-24">WBS#</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium w-28">Man-days</th>
              <th className="px-4 py-3 font-medium w-24">Story Pts</th>
              <th className="px-4 py-3 font-medium w-52">Default Assignee</th>
              <th className="px-4 py-3 font-medium w-40">Sprint</th>
              {canWrite && <th className="px-4 py-3 font-medium w-10" />}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineText value={t.wbsNumber} onSave={(v) => updateWbsTask(t.id, projectId, { wbsNumber: v })} />
                  ) : (
                    <span className="text-slate-600">{t.wbsNumber || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineText value={t.title} onSave={(v) => updateWbsTask(t.id, projectId, { title: v })} />
                  ) : (
                    <span className="text-slate-600">{t.title}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineNumber value={t.manDays} step={0.5} onSave={(v) => updateWbsTask(t.id, projectId, { manDays: v ?? 0 })} />
                  ) : (
                    <span className="text-slate-600">{t.manDays}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <InlineNumber
                      value={t.storyPoints}
                      step={1}
                      onSave={(v) => updateWbsTask(t.id, projectId, { storyPoints: v })}
                    />
                  ) : (
                    <span className="text-slate-600">{t.storyPoints ?? "—"}</span>
                  )}
                </td>
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
            ))}
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
    </div>
  );
}
