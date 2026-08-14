"use client";

import { useTransition } from "react";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";
import { removeProjectMember, setModulePermission } from "./team-actions";

// BUDGET_TRACKER is intentionally omitted — it's Admin-only now
// (lib/rbac-core.ts computeModuleAccess), so a per-membership permission
// for it would be a no-op.
const ALL_MODULES: ModuleName[] = [
  "DASHBOARD",
  "PM_CHECKLIST",
  "DEVOPS_CHECKLIST",
  "MILESTONES",
  "RISK_REGISTER",
  "CR_LOG",
  "PM_PLAN",
  "DECISION_LOG",
  "ACTION_ITEMS",
  "DELIVERY",
];

const ACCESS_LEVELS: AccessLevel[] = ["NONE", "READ_LIMITED", "READ_FULL", "WRITE"];

export type MemberRowData = {
  id: string;
  role: Role;
  userName: string;
  userEmail: string;
  permissions: { module: ModuleName; access: AccessLevel }[];
};

export function MemberRow({ projectId, membership, canEdit }: { projectId: string; membership: MemberRowData; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  const accessFor = (module: ModuleName) => membership.permissions.find((p) => p.module === module)?.access ?? "NONE";

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        <p className="text-slate-800 font-medium">{membership.userName}</p>
        <p className="text-xs text-slate-500">{membership.userEmail}</p>
      </td>
      <td className="px-3 py-2 text-slate-600">{membership.role}</td>
      <td className="px-3 py-2">
        {membership.role === "PM" ? (
          <span className="text-xs text-slate-500">Full read/write on all modules (role-based).</span>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_MODULES.map((m) => (
              <div key={m} className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wide text-slate-400">{m.replace("_", " ")}</label>
                {canEdit ? (
                  <select
                    defaultValue={accessFor(m)}
                    disabled={pending}
                    onChange={(e) => startTransition(() => setModulePermission(membership.id, projectId, m, e.target.value as AccessLevel))}
                    className="text-xs rounded border border-slate-300 px-1.5 py-1"
                  >
                    {ACCESS_LEVELS.map((a) => (
                      <option key={a} value={a}>
                        {a.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-600">{accessFor(m).replace("_", " ")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <button
            onClick={() => startTransition(() => removeProjectMember(membership.id, projectId))}
            disabled={pending}
            title="Remove from project"
            className="text-slate-300 hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
