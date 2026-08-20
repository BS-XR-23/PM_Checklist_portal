"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";

export type RowAction = { label: string; pendingLabel?: string; onClick: () => Promise<void>; danger?: boolean };

/** Generic "•••" row-actions dropdown for table rows (Checklist, Milestones, ...). */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
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
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
            {actions.map((action) => (
              <RowActionItem key={action.label} action={action} onDone={() => setOpen(false)} />
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function RowActionItem({ action, onDone }: { action: RowAction; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action.onClick();
          onDone();
        })
      }
      className={clsx(
        "w-full text-left rounded px-2.5 py-1.5 disabled:opacity-50",
        action.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      )}
    >
      {pending ? action.pendingLabel ?? "Working..." : action.label}
    </button>
  );
}
