"use client";

import { useState, useTransition } from "react";
import { createWbsWeek } from "./delivery-actions";

export function AddWeekModal({ projectId, suggestedDate }: { projectId: string; suggestedDate: string }) {
  const [open, setOpen] = useState(false);
  const [weekEnding, setWeekEnding] = useState(suggestedDate);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => {
          setWeekEnding(suggestedDate);
          setOpen(true);
        }}
        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 shrink-0"
      >
        + Add Week
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add tracking week</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Week Ending</label>
          <input
            type="date"
            value={weekEnding}
            onChange={(e) => setWeekEnding(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
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
                  await createWbsWeek(projectId, weekEnding || null);
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add week.");
                }
              })
            }
            disabled={pending || !weekEnding}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Week"}
          </button>
        </div>
      </div>
    </div>
  );
}
