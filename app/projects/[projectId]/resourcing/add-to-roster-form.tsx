"use client";

import { useState, useTransition } from "react";
import { assignEngagement } from "./resourcing-actions";

/** One-line "add a person" form: pick a person, their role defaults to their registry title, dates optional. */
export function AddToRosterForm({
  projectId,
  people,
  roleOptions,
}: {
  projectId: string;
  people: { id: string; name: string; title: string | null }[]; // registry people not yet on this project
  roleOptions: string[];
}) {
  // Start empty: pre-selecting the alphabetically-first person made it easy
  // to click Add and put the wrong person on a project.
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (people.length === 0) {
    return <p className="text-sm text-slate-400">Everyone in the People registry is already on this project. New people are added at Admin › People.</p>;
  }

  const roles = role && !roleOptions.includes(role) ? [role, ...roleOptions] : roleOptions;
  const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await assignEngagement(projectId, { personId, roleOnProject: role, startDate: startDate || null, endDate: endDate || null });
            setPersonId("");
            setRole("");
            setStartDate("");
            setEndDate("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add.");
          }
        });
      }}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="mb-2 text-sm font-semibold text-slate-900">Add someone to the team</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_1fr_1fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Person</span>
          <select
            required
            value={personId}
            disabled={pending}
            onChange={(e) => {
              setPersonId(e.target.value);
              setRole(people.find((p) => p.id === e.target.value)?.title ?? "");
            }}
            className={field}
          >
            <option value="" disabled>
              Select person
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Role on this project</span>
          <select required value={role} disabled={pending} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="" disabled>
              Select role
            </option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Start (optional)</span>
          <input type="date" value={startDate} disabled={pending} onChange={(e) => setStartDate(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">End (optional)</span>
          <input type="date" value={endDate} disabled={pending} onChange={(e) => setEndDate(e.target.value)} className={field} />
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
          {pending ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </form>
  );
}
