"use client";

import { useState, useTransition } from "react";
import { PM_STAGES, DEVOPS_CATEGORIES } from "@/lib/seed-data";
import type { ChecklistType } from "@/lib/constants";
import { addMilestone } from "./milestone-actions";

export function AddMilestoneModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [checklistType, setChecklistType] = useState<ChecklistType>("PM");
  const stages = checklistType === "PM" ? PM_STAGES : DEVOPS_CATEGORIES;
  const [stage, setStage] = useState<string>(stages[0]);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function changeType(next: ChecklistType) {
    setChecklistType(next);
    setStage((next === "PM" ? PM_STAGES : DEVOPS_CATEGORIES)[0]);
  }

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
          Creates a new checklist item carrying a payment tranche — appears on both the Milestones page and the
          checklist you pick below.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Checklist</label>
            <select
              value={checklistType}
              onChange={(e) => changeType(e.target.value as ChecklistType)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="PM">PM Checklist</option>
              <option value="DEVOPS">DevOps Checklist</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Milestone Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beta Release Signoff"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
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
                await addMilestone(projectId, { checklistType, stage, name: name.trim() || "New Milestone" });
                setOpen(false);
                setName("");
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
