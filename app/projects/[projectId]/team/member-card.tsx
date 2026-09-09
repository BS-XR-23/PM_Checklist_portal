"use client";

import { useTransition } from "react";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { avatarColorFromString, ACCESS_LEVEL_COLORS, MEMBERSHIP_ROLE_COLORS } from "@/lib/colors";
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
  "DEPENDENCIES",
];

const ACCESS_LEVELS: AccessLevel[] = ["NONE", "READ_LIMITED", "READ_FULL", "WRITE"];

export type MemberRowData = {
  id: string;
  role: Role;
  userName: string;
  userEmail: string;
  permissions: { module: ModuleName; access: AccessLevel }[];
};

export function MemberCard({ projectId, membership, canEdit }: { projectId: string; membership: MemberRowData; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  const accessFor = (module: ModuleName) => membership.permissions.find((p) => p.module === module)?.access ?? "NONE";
  const rolePill = MEMBERSHIP_ROLE_COLORS[membership.role] ?? { bg: "#E2E8F0", text: "#475569" };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/40">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColorFromString(membership.userName) }}
        >
          {initials(membership.userName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{membership.userName}</p>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ backgroundColor: rolePill.bg, color: rolePill.text }}
            >
              {ROLE_LABELS[membership.role]}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">{membership.userEmail}</p>
        </div>
        {canEdit && (
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
        )}
      </div>

      <div className="px-4 py-3.5">
        {membership.role === "PM" ? (
          <p className="text-xs text-slate-500">Full read/write on all modules — granted by role, not adjustable per module.</p>
        ) : (
          <div className="space-y-3">
            {canEdit && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Quick preset</span>
                <select
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => {
                    const key = e.target.value;
                    if (!key) return;
                    startTransition(() => applyAccessPreset(membership.id, projectId, key));
                    e.target.value = "";
                  }}
                  className="text-xs rounded-md border border-slate-300 px-2 py-1 text-slate-600"
                >
                  <option value="">Choose…</option>
                  {ACCESS_PRESETS.map((p) => (
                    <option key={p.key} value={p.key} title={p.description}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {ALL_MODULES.map((m) => {
                const level = accessFor(m);
                const style = ACCESS_LEVEL_COLORS[level];
                return (
                  <div key={m} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 truncate">{m.replace(/_/g, " ")}</p>
                    {canEdit ? (
                      <select
                        // Keyed on the current value so a bulk preset apply
                        // (which changes several of these at once, not via
                        // direct interaction with this element) forces a
                        // remount — an uncontrolled select's defaultValue is
                        // otherwise only read on first mount.
                        key={level}
                        defaultValue={level}
                        disabled={pending}
                        onChange={(e) => startTransition(() => setModulePermission(membership.id, projectId, m, e.target.value as AccessLevel))}
                        className="mt-1 w-full rounded-md border-0 px-1.5 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {ACCESS_LEVELS.map((a) => (
                          <option key={a} value={a}>
                            {ACCESS_LEVEL_COLORS[a].label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="mt-1 inline-flex items-center rounded-md px-1.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
