"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { setUserActive, updateUserRole } from "./user-actions";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

export function UserActionsMenu({
  userId,
  currentRole,
  isActive,
  isSelf,
}: {
  userId: string;
  currentRole: Role;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rolePending, startRoleTransition] = useTransition();
  const [activePending, startActiveTransition] = useTransition();
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
        <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg">
          <label className="block px-1 pb-1 text-xs font-medium text-slate-500">Role</label>
          <select
            defaultValue={currentRole}
            disabled={isSelf || rolePending}
            title={isSelf ? "You can't change your own role" : undefined}
            onChange={(e) => startRoleTransition(() => updateUserRole(userId, e.target.value as Role))}
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              disabled={isSelf || activePending}
              title={isSelf ? "You can't deactivate your own account" : undefined}
              onClick={() =>
                startActiveTransition(async () => {
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
              {activePending ? "Updating…" : isActive ? "Deactivate account" : "Reactivate account"}
            </button>
          </div>
          {error && <p className="px-2.5 py-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </span>
  );
}
