"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/constants";
import { setUserActive, updateUserRole, getDeactivationImpact, getDeletionEligibility, deleteUser } from "./user-actions";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];
const PANEL_WIDTH = 288; // matches w-72
const GAP = 4;
const EST_MAX_HEIGHT = 340; // rough upper bound across all panel states, for the open-upward decision

type DeactivationImpact = Awaited<ReturnType<typeof getDeactivationImpact>>;
type DeletionEligibility = Awaited<ReturnType<typeof getDeletionEligibility>>;
type Panel = "NONE" | "DEACTIVATE_IMPACT" | "DELETE_CHECK";

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

function DeletionBlockedLines({ eligibility }: { eligibility: DeletionEligibility }) {
  const lines: string[] = [];
  if (eligibility.auditLogCount > 0) lines.push(`${eligibility.auditLogCount} audit log entr${eligibility.auditLogCount === 1 ? "y" : "ies"}`);
  if (eligibility.escalationCount > 0) lines.push(`${eligibility.escalationCount} escalation${eligibility.escalationCount === 1 ? "" : "s"} raised`);
  if (eligibility.presalesProjectCount > 0) {
    lines.push(`${eligibility.presalesProjectCount} presales opportunit${eligibility.presalesProjectCount === 1 ? "y" : "ies"} created`);
  }
  return (
    <ul className="text-xs text-slate-600 space-y-0.5 list-disc pl-4">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function UserActionsMenu({
  userId,
  email,
  currentRole,
  isActive,
  isSelf,
}: {
  userId: string;
  email: string;
  currentRole: Role;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; openUp: boolean; anchorTop: number; anchorBottom: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<Panel>("NONE");
  const [rolePending, startRoleTransition] = useTransition();
  const [activePending, startActiveTransition] = useTransition();
  const [impactPending, startImpactTransition] = useTransition();
  const [impact, setImpact] = useState<DeactivationImpact | null>(null);
  const [eligibilityPending, startEligibilityTransition] = useTransition();
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function closeMenu() {
    setOpen(false);
    setPanel("NONE");
    setImpact(null);
    setEligibility(null);
    setConfirmEmail("");
    setError(null);
  }

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = rect.bottom + GAP + EST_MAX_HEIGHT > window.innerHeight && rect.top > window.innerHeight - rect.bottom;
    setCoords({ left: Math.max(8, rect.right - PANEL_WIDTH), openUp, anchorTop: rect.top, anchorBottom: rect.bottom });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => closeMenu();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-label="Actions"
        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        •••
      </button>
      {open &&
        coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div
              className="fixed z-50 w-72 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg"
              style={{
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.anchorTop + GAP } : { top: coords.anchorBottom + GAP }),
              }}
            >
          {panel === "DEACTIVATE_IMPACT" && impact ? (
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
                <button type="button" onClick={() => setPanel("NONE")} className="rounded border border-slate-300 text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : panel === "DELETE_CHECK" && eligibility ? (
            <div className="space-y-2 px-1 py-1">
              {eligibility.eligible ? (
                <>
                  <p className="text-xs font-medium text-red-700">
                    This permanently deletes {email}. This can&apos;t be undone — unlike Deactivate, there&apos;s nothing left to restore.
                  </p>
                  <label className="block text-xs text-slate-500">
                    Type <span className="font-mono font-medium text-slate-700">{email}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={deletePending || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
                      onClick={() =>
                        startDeleteTransition(async () => {
                          setError(null);
                          try {
                            await deleteUser(userId);
                            closeMenu();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to delete user.");
                          }
                        })
                      }
                      className="flex-1 rounded bg-red-600 text-white text-xs font-medium px-2 py-1.5 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletePending ? "Deleting…" : "Permanently delete"}
                    </button>
                    <button type="button" onClick={() => setPanel("NONE")} className="rounded border border-slate-300 text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-700">Can&apos;t permanently delete — this account has activity history:</p>
                  <DeletionBlockedLines eligibility={eligibility} />
                  <p className="text-xs text-slate-400">Deactivate it instead — that blocks login without losing the history above.</p>
                  <button type="button" onClick={() => setPanel("NONE")} className="w-full rounded border border-slate-300 text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-50">
                    Close
                  </button>
                </>
              )}
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
                          setPanel("DEACTIVATE_IMPACT");
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
                <button
                  type="button"
                  disabled={isSelf || eligibilityPending}
                  title={isSelf ? "You can't delete your own account" : undefined}
                  onClick={() =>
                    startEligibilityTransition(async () => {
                      setError(null);
                      try {
                        const result = await getDeletionEligibility(userId);
                        setEligibility(result);
                        setPanel("DELETE_CHECK");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to check account.");
                      }
                    })
                  }
                  className="w-full text-left rounded px-2.5 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {eligibilityPending ? "Checking…" : "Delete account"}
                </button>
              </div>
            </>
          )}
              {error && <p className="px-2.5 py-1 text-xs text-red-600">{error}</p>}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
