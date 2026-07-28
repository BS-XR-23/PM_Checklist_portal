"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "./user-actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (tempPassword) {
    return (
      <div className="text-xs">
        <span className="font-mono font-semibold text-green-800 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">{tempPassword}</span>{" "}
        <button onClick={() => setTempPassword(null)} className="text-slate-400 hover:text-slate-700">
          dismiss
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const { tempPassword } = await resetUserPassword(userId);
              setTempPassword(tempPassword);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to reset password.");
            }
          })
        }
        disabled={pending}
        className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
      >
        {pending ? "Resetting..." : "Reset password"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
