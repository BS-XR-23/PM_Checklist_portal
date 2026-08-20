"use client";

import { useState } from "react";

export function PersonActionsMenu({
  editing,
  onToggleEdit,
  onDelete,
  deletePending,
}: {
  editing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const [open, setOpen] = useState(false);

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
        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
          <button
            type="button"
            onClick={() => {
              onToggleEdit();
              setOpen(false);
            }}
            className="w-full text-left rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            {editing ? "Done editing" : "Edit"}
          </button>
          <button
            type="button"
            disabled={deletePending}
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className="w-full text-left rounded px-2.5 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </span>
  );
}
