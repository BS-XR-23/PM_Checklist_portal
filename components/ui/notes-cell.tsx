"use client";

import { useState } from "react";
import { InlineTextarea } from "./inline-edit";

/** "Add note" / "View note" toggle that expands into an inline editable textarea — used by any
 * table cell (Checklist, Milestones, ...) that carries a free-text notes field. */
export function NotesCell({
  value,
  canWrite,
  onSave,
}: {
  value: string | null;
  canWrite: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!canWrite) {
    return value ? <span className="text-sm text-slate-600">{value}</span> : <span className="text-slate-300">—</span>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-indigo-600 hover:underline whitespace-nowrap">
        {value ? "View note" : "Add note"}
      </button>
    );
  }

  return (
    <div className="min-w-[180px]">
      <InlineTextarea value={value ?? ""} placeholder="—" onSave={onSave} />
      <button type="button" onClick={() => setOpen(false)} className="mt-1 text-[11px] text-slate-400 hover:text-slate-600">
        Close
      </button>
    </div>
  );
}
