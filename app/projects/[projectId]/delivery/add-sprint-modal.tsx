"use client";

import { useState, useTransition } from "react";
import { createSprint } from "./delivery-actions";

export function AddSprintModal({ projectId, suggestedName }: { projectId: string; suggestedName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => {
          setName(suggestedName);
          setStartDate("");
          setEndDate("");
          setOpen(true);
        }}
        className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50 shrink-0"
      >
        + Add Sprint
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add sprint</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await createSprint(projectId, name, startDate, endDate);
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add sprint.");
                }
              })
            }
            disabled={pending || !name.trim() || !startDate || !endDate}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Sprint"}
          </button>
        </div>
      </div>
    </div>
  );
}
