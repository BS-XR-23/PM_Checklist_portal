"use client";

import { useTransition } from "react";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { avatarColorFromString, tagPillStyle } from "@/lib/colors";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";
import { ACCESS_PRESETS } from "@/lib/rbac-core";
import { removeProjectMember, setModulePermission, applyAccessPreset } from "./team-actions";

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
  const rolePill = tagPillStyle(membership.role);

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(membership.userName) }}
          >
            {initials(membership.userName)}
          </span>
          <div>
            <p className="text-slate-800 font-medium">{membership.userName}</p>
            <p className="text-xs text-slate-500">{membership.userEmail}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: rolePill.bg, color: rolePill.text }}
        >
          {ROLE_LABELS[membership.role]}
        </span>
      </td>
      <td className="px-3 py-2">
        {membership.role === "PM" ? (
          <span className="text-xs text-slate-500">Full read/write on all modules (role-based).</span>
        ) : (
          <div className="space-y-2">
            {canEdit && (
              <select
                defaultValue=""
                disabled={pending}
                onChange={(e) => {
                  const key = e.target.value;
                  if (!key) return;
                  startTransition(() => applyAccessPreset(membership.id, projectId, key));
                  e.target.value = "";
                }}
                className="text-xs rounded border border-slate-300 px-1.5 py-1 text-slate-500"
              >
                <option value="">Apply preset…</option>
                {ACCESS_PRESETS.map((p) => (
                  <option key={p.key} value={p.key} title={p.description}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_MODULES.map((m) => (
                <div key={m} className="flex flex-col">
                  <label className="text-[10px] uppercase tracking-wide text-slate-400">{m.replace("_", " ")}</label>
                  {canEdit ? (
                    <select
                      // Keyed on the current value so a bulk preset apply (which
                      // changes several of these at once, not via direct user
                      // interaction with this element) forces a remount — an
                      // uncontrolled select's defaultValue is otherwise only
                      // read on first mount and won't pick up the new prop.
                      key={accessFor(m)}
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
          </div>
        )}
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <RowActionsMenu
            actions={[
              {
                label: "Remove from project",
                pendingLabel: "Removing...",
                danger: true,
                onClick: () => removeProjectMember(membership.id, projectId),
              },
            ]}
          />
        </td>
      )}
    </tr>
  );
}
