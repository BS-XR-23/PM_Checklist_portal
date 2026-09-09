"use client";

import { useState, useTransition } from "react";
import { createUatDefect } from "./uat-actions";

export function AddUatDefectModal({ projectId, cases }: { projectId: string; cases: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [uatCaseId, setUatCaseId] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800">
        + Log Defect
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Log UAT Defect</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout button unresponsive on Safari" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        {cases.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Related Test Case</label>
            <select value={uatCaseId} onChange={(e) => setUatCaseId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">—</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
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
                await createUatDefect(projectId, { title: title.trim() || "New Defect", uatCaseId: uatCaseId || null });
                setOpen(false);
                setTitle("");
                setUatCaseId("");
              })
            }
            disabled={pending || !title.trim()}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Logging..." : "Log Defect"}
          </button>
        </div>
      </div>
    </div>
  );
}
