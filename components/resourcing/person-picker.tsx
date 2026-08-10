"use client";

import { useTransition } from "react";

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
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="w-full bg-transparent text-sm px-1.5 py-1 rounded hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
      defaultValue={personId ?? ""}
      disabled={pending}
      onChange={(e) => startTransition(() => onSave(e.target.value || null))}
    >
      <option value="">{legacyText ? `${legacyText} (unlinked)` : "—"}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
