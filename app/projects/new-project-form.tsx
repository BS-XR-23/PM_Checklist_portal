"use client";

import { useEffect, useState, useTransition } from "react";
import { createProjectAction } from "./actions";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

/**
 * Super-Admin "New Project" — a dialog instead of a form that expanded
 * inline in the page header and pushed the whole list down. What it says it
 * creates is read from the live Checklist Template (checklistSummary), not
 * hard-coded counts that drift when the template is edited.
 */
export function NewProjectDialog({ pmUsers, checklistSummary }: { pmUsers: { id: string; name: string }[]; checklistSummary: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        + New Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onClick={(e) => e.stopPropagation()}
            action={(formData) =>
              startTransition(async () => {
                setError(null);
                try {
                  await createProjectAction(formData);
                } catch (err) {
                  // redirect() on success throws a NEXT_REDIRECT that must propagate.
                  if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
                  setError(err instanceof Error ? err.message : "Failed to create the project.");
                }
              })
            }
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div>
              <h2 id="new-project-title" className="text-lg font-semibold text-slate-900">
                New project
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sets up the project&apos;s checklists from the Checklist Template{checklistSummary ? ` (${checklistSummary} items)` : ""} and a PM Plan pre-filled
                with the template defaults. Client milestones and payments are added afterwards on Milestones &amp; Payments. Won a presales deal? Use{" "}
                <span className="font-medium">Mark as won</span> on the deal instead — it creates the project for you.
              </p>
            </div>

            <div>
              <label className={labelClass}>Project name *</label>
              <input name="name" required autoFocus className={inputClass} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Client</label>
                <input name="client" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Total contract value ($)</label>
                <input name="contractValue" type="number" step="0.01" min="0" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Project manager</label>
              <select name="pmUserId" defaultValue="" className={inputClass}>
                <option value="">Assign later (Team tab)</option>
                {pmUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {pmUsers.length === 0 && <p className="mt-1 text-[11px] text-slate-400">No active users with the PM role yet — add one in Admin → Users.</p>}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {pending ? "Creating..." : "Create project"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
