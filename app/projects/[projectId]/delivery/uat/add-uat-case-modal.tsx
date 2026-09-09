"use client";

import { useState, useTransition } from "react";
import { createUatCase } from "./uat-actions";

export function AddUatCaseModal({ projectId, releases }: { projectId: string; releases: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800">
        + Add Test Case
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add UAT Test Case</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title / Scenario</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. User can complete checkout" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        {releases.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Release / Build</label>
            <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">—</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => setOpen(false)} disabled={pending} className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await createUatCase(projectId, { title: title.trim() || "New Test Case", releaseId: releaseId || null });
                setOpen(false);
                setTitle("");
                setReleaseId("");
              })
            }
            disabled={pending || !title.trim()}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Test Case"}
          </button>
        </div>
      </div>
    </div>
  );
}
