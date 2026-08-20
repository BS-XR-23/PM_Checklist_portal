"use client";

import { useState, useTransition } from "react";
import { createCompetency } from "./competency-actions";

export function CreateCompetencyForm() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
      >
        + Add Competency
      </button>
    );
  }

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
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create competency.");
          }
        });
      }}
      className="space-y-2"
    >
      <input
        required
        autoFocus
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        placeholder="Level name"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="number"
        step={0.1}
        min={0}
        value={multiplier}
        onChange={(e) => setMultiplier(e.target.value)}
        placeholder="Multiplier (1.0 = baseline)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
