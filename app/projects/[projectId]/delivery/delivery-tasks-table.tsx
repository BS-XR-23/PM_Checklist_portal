"use client";

import { useState, useTransition } from "react";
import { InlineText, InlineNumber, InlinePercent } from "@/components/ui/inline-edit";
import { addWbsTask, updateWbsTask, deleteWbsTask } from "./delivery-actions";

export type WbsTaskData = {
  id: string;
  wbsNumber: string;
  title: string;
  manDays: number;
  pctComplete: number;
  actualManDays: number;
  personId: string | null;
  personName: string | null;
};
export type RosterPerson = { personId: string; personName: string; competencyLevel: string | null };

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

export function DeliveryTasksTable({
  projectId,
  wbsWeekId,
  tasks,
  roster,
  canWrite,
}: {
  projectId: string;
  wbsWeekId: string;
  tasks: WbsTaskData[];
  roster: RosterPerson[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0 && !canWrite) {
    return <p className="text-xs text-slate-400 py-2">No tasks logged for this week.</p>;
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
            {canWrite && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlineText value={t.wbsNumber} onSave={(v) => updateWbsTask(t.id, projectId, { wbsNumber: v })} />
                ) : (
                  <span className="text-slate-600">{t.wbsNumber || "—"}</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlineText value={t.title} onSave={(v) => updateWbsTask(t.id, projectId, { title: v })} />
                ) : (
                  <span className="text-slate-600">{t.title}</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlineNumber value={t.manDays} step={0.5} onSave={(v) => updateWbsTask(t.id, projectId, { manDays: v ?? 0 })} />
                ) : (
                  <span className="text-slate-600">{t.manDays}</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlinePercent value={t.pctComplete} onSave={(v) => updateWbsTask(t.id, projectId, { pctComplete: v })} />
                ) : (
                  <span className="text-slate-600">{Math.round(t.pctComplete * 100)}%</span>
                )}
              </td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <InlineNumber value={t.actualManDays} step={0.5} onSave={(v) => updateWbsTask(t.id, projectId, { actualManDays: v ?? 0 })} />
                ) : (
                  <span className="text-slate-600">{t.actualManDays}</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-slate-700 font-medium">{(t.manDays * t.pctComplete).toFixed(1)}</td>
              <td className="py-1.5 pr-2">
                {canWrite ? (
                  <PersonSelect rowId={t.id} projectId={projectId} value={t.personId ?? ""} roster={roster} />
                ) : (
                  <span className="text-slate-600">{t.personName ?? "—"}</span>
                )}
              </td>
              {canWrite && (
                <td className="py-1.5">
                  <button
                    onClick={() => startTransition(() => deleteWbsTask(t.id, projectId))}
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

      {canWrite && (
        <button
          onClick={() => startTransition(() => addWbsTask(wbsWeekId, projectId))}
          disabled={pending}
          className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          + Add row
        </button>
      )}
    </div>
  );
}
