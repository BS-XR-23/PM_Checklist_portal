"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/admin/users/user-actions";

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
        Change password
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>

        {success ? (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
            Password changed.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={pending}
            className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50"
          >
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              onClick={() => {
                setError(null);
                if (newPassword !== confirmPassword) {
                  setError("New passwords don't match.");
                  return;
                }
                startTransition(async () => {
                  try {
                    await changePassword(currentPassword, newPassword);
                    setSuccess(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to change password.");
                  }
                });
              }}
              disabled={pending || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
