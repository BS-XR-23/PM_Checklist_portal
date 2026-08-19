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
      className="space-y-2"
    >
      <input
        required
        value={roleName}
        onChange={(e) => setRoleName(e.target.value)}
        placeholder="Role name"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="number"
        step={1}
        min={0}
        value={manDayRate}
        onChange={(e) => setManDayRate(e.target.value)}
        placeholder="Man-day rate"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Adding..." : "+ Add Role Rate"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
