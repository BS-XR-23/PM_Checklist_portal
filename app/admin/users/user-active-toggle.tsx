"use client";

import { useTransition } from "react";
import { setUserActive } from "./user-actions";

export function UserActiveToggle({ userId, isActive, disabled }: { userId: string; isActive: boolean; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
      <button
        onClick={() => startTransition(() => setUserActive(userId, !isActive))}
        disabled={disabled || pending}
        title={disabled ? "You can't deactivate your own account" : undefined}
        className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "..." : isActive ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}
