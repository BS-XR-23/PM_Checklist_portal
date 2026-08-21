"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/constants";
import { setUserActive, updateUserRole, getDeactivationImpact } from "./user-actions";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

type DeactivationImpact = Awaited<ReturnType<typeof getDeactivationImpact>>;

function ImpactLines({ impact }: { impact: DeactivationImpact }) {
  const lines: string[] = [];
  if (impact.membershipCount > 0) {
    lines.push(`${impact.membershipCount} project membership${impact.membershipCount === 1 ? "" : "s"}`);
  }
  if (impact.personLinked) {
    if (impact.activeEngagementCount > 0) {
      lines.push(`${impact.activeEngagementCount} active staffing engagement${impact.activeEngagementCount === 1 ? "" : "s"}`);
    }
    if (impact.openOwnedItemCount > 0) {
      lines.push(`${impact.openOwnedItemCount} open item${impact.openOwnedItemCount === 1 ? "" : "s"} they own (checklist/risk/action)`);
    }
  }

  if (lines.length === 0) {
    return <p className="text-xs text-slate-400">Nothing else found — clean to deactivate.</p>;
  }
  return (
    <ul className="text-xs text-slate-600 space-y-0.5 list-disc pl-4">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
      {!impact.personLinked && <li className="text-slate-400">Not linked to a Person record, so no owned items were checked.</li>}
    </ul>
  );
}

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
  const [impactPending, startImpactTransition] = useTransition();
  const [impact, setImpact] = useState<DeactivationImpact | null>(null);
  const [error, setError] = useState<string | null>(null);

  function closeMenu() {
    setOpen(false);
    setImpact(null);
    setError(null);
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : setOpen(true))}
        aria-label="Actions"
        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        •••
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg">
          {impact ? (
            <div className="space-y-2 px-1 py-1">
              <p className="text-xs font-medium text-slate-700">Deactivating won&apos;t automatically remove:</p>
              <ImpactLines impact={impact} />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={activePending}
                  onClick={() =>
                    startActiveTransition(async () => {
                      setError(null);
                      try {
                        await setUserActive(userId, false);
                        closeMenu();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to update status.");
                      }
                    })
                  }
                  className="flex-1 rounded bg-red-600 text-white text-xs font-medium px-2 py-1.5 hover:bg-red-700 disabled:opacity-50"
                >
                  {activePending ? "Deactivating…" : "Confirm deactivate"}
                </button>
                <button
                  type="button"
                  onClick={() => setImpact(null)}
                  className="rounded border border-slate-300 text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link
                href={`/admin/users/${userId}/access`}
                onClick={() => setOpen(false)}
                className="block rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                View access
              </Link>
              <label className="block px-1 pb-1 pt-1.5 text-xs font-medium text-slate-500 border-t border-slate-100 mt-1">Role</label>
              <select
                defaultValue={currentRole}
                disabled={isSelf || rolePending}
                title={isSelf ? "You can't change your own role" : undefined}
                onChange={(e) => startRoleTransition(() => updateUserRole(userId, e.target.value as Role))}
                className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  disabled={isSelf || impactPending || activePending}
                  title={isSelf ? "You can't deactivate your own account" : undefined}
                  onClick={() => {
                    if (isActive) {
                      startImpactTransition(async () => {
                        setError(null);
                        try {
                          const result = await getDeactivationImpact(userId);
                          setImpact(result);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to check account.");
                        }
                      });
                      return;
                    }
                    startActiveTransition(async () => {
                      setError(null);
                      try {
                        await setUserActive(userId, true);
                        closeMenu();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to update status.");
                      }
                    });
                  }}
                  className="w-full text-left rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {impactPending ? "Checking…" : activePending ? "Updating…" : isActive ? "Deactivate account" : "Reactivate account"}
                </button>
              </div>
            </>
          )}
          {error && <p className="px-2.5 py-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </span>
  );
}
