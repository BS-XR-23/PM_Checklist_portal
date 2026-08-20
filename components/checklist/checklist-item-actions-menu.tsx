"use client";

import { useState, useTransition } from "react";

export function ChecklistItemActionsMenu({ onDelete }: { onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        •••
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await onDelete();
                  setOpen(false);
                })
              }
              className="w-full text-left rounded px-2.5 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {pending ? "Deleting..." : "Delete item"}
            </button>
          </div>
        </>
      )}
    </span>
  );
}
