"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InlineNumber, InlinePercent } from "@/components/ui/inline-edit";
import { addWbsWeekEntry, updateWbsWeekEntry, deleteWbsWeekEntry } from "./delivery-actions";
import type { RosterPerson } from "./delivery-tasks-table";

export type WeekEntryData = {
  id: string;
  wbsTaskId: string;
  wbsNumber: string;
  title: string;
  manDays: number; // from the master task — the estimate, not editable here
  pctComplete: number;
  actualManDays: number;
  personId: string | null;
  personName: string | null;
  sprintName: string | null; // resolved from the task's WbsTask.sprintId — commit on the Tasks tab, read-only here
};
export type MasterTaskOption = { id: string; wbsNumber: string; title: string };

function AssigneeSelect({ entryId, projectId, value, roster }: { entryId: string; projectId: string; value: string; roster: RosterPerson[] }) {
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
              await updateWbsWeekEntry(entryId, projectId, { personId: e.target.value || null });
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

function AddTaskFromWbs({
  projectId,
  wbsWeekId,
  available,
  hasMasterTasks,
}: {
  projectId: string;
  wbsWeekId: string;
  available: MasterTaskOption[];
  hasMasterTasks: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!hasMasterTasks) {
    return (
      <p className="text-xs text-slate-400 mt-2">
        No WBS tasks defined yet —{" "}
        <Link href={`/projects/${projectId}/delivery/tasks`} className="text-indigo-600 hover:underline">
          add some on the Tasks tab
        </Link>{" "}
        first.
      </p>
    );
  }
  if (available.length === 0) {
    return <p className="text-xs text-slate-400 mt-2">Every WBS task is already tracked this week.</p>;
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <select
        className="rounded border border-slate-200 px-2 py-1 text-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending}
      >
        <option value="">Add task from WBS…</option>
        {available.map((t) => (
          <option key={t.id} value={t.id}>
            {t.wbsNumber ? `${t.wbsNumber} — ` : ""}
            {t.title}
          </option>
        ))}
      </select>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await addWbsWeekEntry(wbsWeekId, selected, projectId);
              setSelected("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add task.");
            }
          })
        }
        disabled={pending || !selected}
        className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
      >
        + Add
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function WeekEntriesTable({
  projectId,
  wbsWeekId,
  entries,
  availableTasks,
  hasMasterTasks,
  roster,
  canWrite,
}: {
  projectId: string;
  wbsWeekId: string;
  entries: WeekEntryData[];
  availableTasks: MasterTaskOption[];
  hasMasterTasks: boolean;
  roster: RosterPerson[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (entries.length === 0 && !canWrite) {
    return <p className="text-xs text-slate-400 py-2">No tasks tracked this week.</p>;
  }

  return (
    <div className="py-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="font-medium py-1 pr-2 w-20">WBS#</th>
            <th className="font-medium py-1 pr-2">Title</th>
            <th className="font-medium py-1 pr-2 w-24">Man-days</th>
            <th className="font-medium py-1 pr-2 w-24">%</th>
            <th className="font-medium py-1 pr-2 w-24">Actual MD</th>
            <th className="font-medium py-1 pr-2 w-20">Total</th>
            <th className="font-medium py-1 pr-2 w-44">Assignee</th>
            <th className="font-medium py-1 pr-2 w-28">Sprint</th>
            {canWrite && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2 text-slate-600">{e.wbsNumber || "—"}</td>
              <td className="py-1.5 pr-2 text-slate-600">{e.title}</td>
              <td className="py-1.5 pr-2 text-slate-500">{e.manDays}</td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlinePercent value={e.pctComplete} onSave={(v) => updateWbsWeekEntry(e.id, projectId, { pctComplete: v })} />
                ) : (
                  <span className="text-slate-600">{Math.round(e.pctComplete * 100)}%</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlineNumber value={e.actualManDays} step={0.5} onSave={(v) => updateWbsWeekEntry(e.id, projectId, { actualManDays: v ?? 0 })} />
                ) : (
                  <span className="text-slate-600">{e.actualManDays}</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-slate-700 font-medium">{(e.manDays * e.pctComplete).toFixed(1)}</td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <AssigneeSelect entryId={e.id} projectId={projectId} value={e.personId ?? ""} roster={roster} />
                ) : (
                  <span className="text-slate-600">{e.personName ?? "—"}</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-slate-500">{e.sprintName ?? "—"}</td>
              {canWrite && (
                <td className="py-1.5">
                  <button
                    onClick={() => startTransition(() => deleteWbsWeekEntry(e.id, projectId))}
                    disabled={pending}
                    title="Remove from this week"
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

      {canWrite && (
        <AddTaskFromWbs projectId={projectId} wbsWeekId={wbsWeekId} available={availableTasks} hasMasterTasks={hasMasterTasks} />
      )}
    </div>
  );
}
