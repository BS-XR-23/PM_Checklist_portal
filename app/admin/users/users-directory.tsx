"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import type { ReactNode } from "react";
import { UserRoleSelect } from "./user-role-select";
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
  badgeClass: string;
  users: UserRow[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function matchesSearch(u: UserRow, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
}

function RoleGroupSection({ group, currentUserId }: { group: RoleGroupData; currentUserId: string }) {
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
        <span className="text-sm font-bold text-slate-900">{group.label}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${group.badgeClass}`}>
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
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5 w-44">Role</th>
                <th className="px-4 py-2.5 w-40">Resource</th>
                <th className="px-4 py-2.5 w-32">Password</th>
                <th className="px-4 py-2.5 w-24">Status</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {group.users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={`border-t border-slate-100 ${u.isActive ? "" : "opacity-50"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${group.avatarClass}`}
                        >
                          {initials(u.name)}
                        </span>
                        <span className="font-medium text-slate-800">
                          <UserProfileField userId={u.id} field="name" value={u.name} />
                        </span>
                        {isSelf && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      <UserProfileField userId={u.id} field="email" value={u.email} />
                    </td>
                    <td className="px-4 py-2.5">
                      <UserRoleSelect userId={u.id} currentRole={u.role} disabled={isSelf} />
                    </td>
                    <td className="px-4 py-2.5">
                      {u.personName ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {u.personName}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ResetPasswordButton userId={u.id} />
                    </td>
                    <td className="px-4 py-2.5">
                      <UserActiveToggle isActive={u.isActive} />
                    </td>
                    <td className="px-4 py-2.5">
                      <UserActionsMenu userId={u.id} isActive={u.isActive} isSelf={isSelf} />
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

export function UsersDirectory({ groups, currentUserId }: { groups: RoleGroupData[]; currentUserId: string }) {
  const [search, setSearch] = useState("");

  const filteredGroups = groups.map((g) => ({ ...g, users: g.users.filter((u) => matchesSearch(u, search)) }));
  const anyResults = filteredGroups.some((g) => g.users.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {!anyResults && (
        <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No users match &quot;{search}&quot;.</p>
      )}
      {filteredGroups.map((g) => (
        <RoleGroupSection key={g.key} group={g} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
