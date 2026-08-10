"use client";

import { useState, useTransition } from "react";
import { createRoleRate } from "./role-rate-actions";

export function CreateRoleRateForm() {
  const [roleName, setRoleName] = useState("");
  const [manDayRate, setManDayRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createRoleRate({ roleName, manDayRate: manDayRate === "" ? 0 : Number(manDayRate) });
            setRoleName("");
            setManDayRate("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create role rate.");
          }
        });
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">Add Role Rate</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
          <input
            required
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Senior Engineer"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Man-Day Rate</label>
          <input
            required
            type="number"
            step={1}
            min={0}
            value={manDayRate}
            onChange={(e) => setManDayRate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Adding..." : "Add Role Rate"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
