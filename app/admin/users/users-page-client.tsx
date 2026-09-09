"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { IconSearch } from "@/components/layout/icons";
import { CreateUserForm } from "./create-user-form";
import { ImportUsersButton } from "./import-users-button";
import { RoleGroupSection, type RoleGroupData } from "./users-directory";

function matchesSearch(name: string, email: string, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return name.toLowerCase().includes(s) || email.toLowerCase().includes(s);
}

type Tab = "ACTIVE" | "ARCHIVED";

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.1rem] text-[10px] font-semibold",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// Search lives in the page header (next to the title), so its state has to
// sit above both the header row and the directory list below it — the two
// are siblings in the layout, not parent/child.
export function UsersPageClient({
  groups,
  currentUserId,
  sidebar,
  canEdit,
}: {
  groups: RoleGroupData[];
  currentUserId: string;
  sidebar: ReactNode;
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("ACTIVE");

  const activeCount = groups.reduce((n, g) => n + g.users.filter((u) => u.isActive).length, 0);
  const archivedCount = groups.reduce((n, g) => n + g.users.filter((u) => !u.isActive).length, 0);

  const tabGroups = groups.map((g) => ({
    ...g,
    users: g.users.filter((u) => (tab === "ACTIVE" ? u.isActive : !u.isActive)),
  }));
  const filteredGroups = tabGroups.map((g) => ({
    ...g,
    users: g.users.filter((u) => matchesSearch(u.name, u.email, search)),
  }));
  const anyResults = filteredGroups.some((g) => g.users.length > 0);

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage portal users and assign them to projects with specific roles.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-72 rounded-lg border border-slate-300 pl-8 pr-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          {canEdit && <ImportUsersButton />}
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            {canEdit && <CreateUserForm />}
            <div className="flex items-center gap-2">
              <TabButton label="Active" count={activeCount} active={tab === "ACTIVE"} onClick={() => setTab("ACTIVE")} />
              <TabButton label="Archived" count={archivedCount} active={tab === "ARCHIVED"} onClick={() => setTab("ARCHIVED")} />
            </div>
            <div className="space-y-4">
              {!anyResults && (
                <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
                  {search
                    ? `No users match "${search}".`
                    : tab === "ARCHIVED"
                      ? "No archived users — everyone here is active."
                      : "No active users."}
                </p>
              )}
              {filteredGroups.map((g) => (
                <RoleGroupSection key={g.key} group={g} currentUserId={currentUserId} canEdit={canEdit} />
              ))}
            </div>
          </div>

          <div className="space-y-4">{sidebar}</div>
        </div>

        {canEdit && (
          <p className="text-xs text-slate-400 mt-4">
            Assigning a user to a specific project (PM / CLIENT / LIMITED) happens on that project&apos;s Team tab,
            not here — role here is the global role only.
          </p>
        )}
      </main>
    </>
  );
}
