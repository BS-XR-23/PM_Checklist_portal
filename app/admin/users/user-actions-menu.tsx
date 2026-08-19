"use client";

import { useState, useTransition } from "react";
import { setUserActive } from "./user-actions";

export function UserActionsMenu({ userId, isActive, isSelf }: { userId: string; isActive: boolean; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
          <button
            type="button"
            disabled={isSelf || pending}
            title={isSelf ? "You can't deactivate your own account" : undefined}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await setUserActive(userId, !isActive);
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to update status.");
                }
              })
            }
            className="w-full text-left rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Updating…" : isActive ? "Deactivate account" : "Reactivate account"}
          </button>
          {error && <p className="px-2.5 py-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </span>
  );
}
