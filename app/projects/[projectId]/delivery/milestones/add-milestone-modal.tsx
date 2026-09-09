"use client";

import { useState, useTransition } from "react";
import { MILESTONE_TYPES, MILESTONE_TYPE_LABELS } from "@/lib/constants";
import { createMilestone } from "./milestone-actions";
import type { MilestoneType } from "@prisma/client";

export function AddMilestoneModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<MilestoneType>("DEVELOPMENT");
  const [plannedDate, setPlannedDate] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 shrink-0"
      >
        + Add Milestone
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add Milestone</h3>
        <p className="text-xs text-slate-500">
          A major delivery checkpoint — not an individual task. Full details (owner, forecast date, acceptance
          criteria) can be filled in after creating it.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Milestone Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MVP Complete"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MilestoneType)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {MILESTONE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MILESTONE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Planned Date</label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

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
                await createMilestone(projectId, { name: name.trim() || "New Milestone", type, plannedDate: plannedDate || null });
                setOpen(false);
                setName("");
                setPlannedDate("");
              })
            }
            disabled={pending || !name.trim()}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Milestone"}
          </button>
        </div>
      </div>
    </div>
  );
}
