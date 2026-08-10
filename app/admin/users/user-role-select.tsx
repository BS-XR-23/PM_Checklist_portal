"use client";

import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { updateUserRole } from "./user-actions";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

export function UserRoleSelect({ userId, currentRole, disabled }: { userId: string; currentRole: Role; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentRole}
      disabled={disabled || pending}
      title={disabled ? "You can't change your own role" : undefined}
      onChange={(e) => startTransition(() => updateUserRole(userId, e.target.value as Role))}
      className="text-sm rounded border border-slate-300 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {ALL_ROLES.map((r) => (
        <option key={r} value={r}>
          {r.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
