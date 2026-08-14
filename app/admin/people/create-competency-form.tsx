"use client";

import { useState, useTransition } from "react";
import { createCompetency } from "./competency-actions";

export function CreateCompetencyForm() {
  const [level, setLevel] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createCompetency({ level, multiplier: multiplier === "" ? 1 : Number(multiplier) });
            setLevel("");
            setMultiplier("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create competency.");
          }
        });
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">Add Competency</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
          <input
            required
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="e.g. Senior"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Multiplier</label>
          <input
            required
            type="number"
            step={0.1}
            min={0}
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            placeholder="1.0 = baseline"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Adding..." : "Add Competency"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
