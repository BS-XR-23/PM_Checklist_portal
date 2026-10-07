"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";

const errorTextClass = "text-xs text-red-600 mt-0.5";
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to save.";
}

/**
 * Links an owner/stakeholder row to a canonical Person record instead of
 * re-typing a name. Only existing People are selectable here (creating a new
 * Person is Admin-only, via Admin > People) — this picker never writes free
 * text, only a personId.
 */
export function PersonPicker({
  personId,
  legacyText,
  people,
  onSave,
}: {
  personId: string | null;
  legacyText: string | null;
  people: { id: string; name: string }[];
  onSave: (personId: string | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState(personId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A native <select> clips its displayed value with no ellipsis once the
  // text outgrows a narrow column (e.g. a checklist's Owner cell) — the
  // title tooltip is the only way to recover the full name without widening
  // every table that embeds this.
  const selectedName = people.find((p) => p.id === selected)?.name ?? legacyText ?? undefined;

  return (
    <div>
      <select
        className={clsx(
          "w-full bg-transparent text-sm px-1.5 py-1 rounded hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50",
          error && "ring-1 ring-red-400"
        )}
        value={selected}
        disabled={pending}
        title={selectedName}
        onChange={(e) => {
          const next = e.target.value;
          const prev = selected;
          setSelected(next);
          setError(null);
          startTransition(async () => {
            try {
              await onSave(next || null);
            } catch (err) {
              setError(errorMessage(err));
              setSelected(prev);
            }
          });
        }}
      >
        <option value="">{legacyText ? `${legacyText} (unlinked)` : "—"}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {error && <p className={errorTextClass}>{error}</p>}
    </div>
  );
}
