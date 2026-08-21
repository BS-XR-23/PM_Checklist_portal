"use client";

import { useState, useTransition } from "react";
import { addProgramOversight, removeProgramOversight } from "./oversight-actions";

export type OversightRow = { id: string; projectId: string; projectName: string };

export function OversightEditor({
  programManagerId,
  overseen,
  assignableProjects,
}: {
  programManagerId: string;
  overseen: OversightRow[];
  assignableProjects: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Oversees</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Organizational record only — doesn&apos;t grant drill-down into these projects. Purely so it&apos;s recorded who
          this Program Manager is responsible for.
        </p>
      </div>

      {overseen.length === 0 ? (
        <p className="text-sm text-slate-400">No projects recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {overseen.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5">
              <span className="text-sm text-slate-700">{row.projectName}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await removeProgramOversight(row.id, programManagerId);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to remove.");
                    }
                  })
                }
                className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {assignableProjects.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
            className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Add a project…</option>
            {assignableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await addProgramOversight(programManagerId, selected);
                  setSelected("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add.");
                }
              })
            }
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
