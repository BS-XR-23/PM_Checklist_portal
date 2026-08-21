"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";
import { ResetPasswordButton } from "./reset-password-button";
import { UserActiveToggle } from "./user-active-toggle";
import { UserActionsMenu } from "./user-actions-menu";
import { UserProfileField } from "./user-profile-field";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  personName: string | null;
};

export type RoleGroupData = {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  iconWrapClass: string;
  avatarClass: string;
  users: UserRow[];
};

export function RoleGroupSection({ group, currentUserId }: { group: RoleGroupData; currentUserId: string }) {
  const [collapsed, setCollapsed] = useState(false);
  if (group.users.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${group.iconWrapClass}`}>
          <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{group.icon}</span>
        </span>
        <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">{group.label}</span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {group.users.length}
        </span>
        <span className="hidden sm:inline text-xs text-slate-400">{group.description}</span>
        <span className={`ml-auto text-slate-400 text-xs transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
                <th className="px-4 py-3 min-w-[200px]">User</th>
                <th className="px-4 py-3 min-w-[200px]">Email</th>
                <th className="px-4 py-3 w-40">Resource</th>
                <th className="px-4 py-3 w-32">Password</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {group.users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={`border-t border-slate-100 ${u.isActive ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${group.avatarClass}`}
                        >
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0 flex-1 font-medium text-slate-800">
                          <UserProfileField userId={u.id} field="name" value={u.name} />
                        </div>
                        {isSelf && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      <UserProfileField userId={u.id} field="email" value={u.email} />
                    </td>
                    <td className="px-4 py-3.5">
                      {u.personName ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {u.personName}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                          title="No linked Person record — can't be picked as an Owner (Checklist/Risk/Action items) or staffed on a project."
                        >
                          Not linked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <ResetPasswordButton userId={u.id} />
                    </td>
                    <td className="px-4 py-3.5">
                      <UserActiveToggle isActive={u.isActive} />
                    </td>
                    <td className="px-4 py-3.5">
                      <UserActionsMenu userId={u.id} currentRole={u.role} isActive={u.isActive} isSelf={isSelf} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
