"use client";

import { useState, useTransition } from "react";
import { createProjectAction } from "./actions";

export function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
      >
        + New Project
      </button>
    );
  }

  return (
    <form
      action={(formData) => startTransition(() => createProjectAction(formData))}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">New Project</h2>
      <p className="text-xs text-slate-500">
        Creates a fresh instance of all 8 modules: 51 PM Checklist items, 18 DevOps Checklist items, their 15
        derived milestones, and a PM Plan pre-filled with the template defaults.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project Name *</label>
          <input name="name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
          <input name="client" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total Contract Value ($)</label>
          <input
            name="contractValue"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total Planned Man-Days</label>
          <input
            name="plannedManDays"
            type="number"
            step="0.5"
            min="0"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Project"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
