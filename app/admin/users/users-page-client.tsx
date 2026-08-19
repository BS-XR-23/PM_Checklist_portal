"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { CreateUserForm } from "./create-user-form";
import { RoleGroupSection, type RoleGroupData } from "./users-directory";

function matchesSearch(name: string, email: string, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return name.toLowerCase().includes(s) || email.toLowerCase().includes(s);
}

// Search lives in the page header (next to the title), so its state has to
// sit above both the header row and the directory list below it — the two
// are siblings in the layout, not parent/child.
export function UsersPageClient({
  groups,
  currentUserId,
  sidebar,
}: {
  groups: RoleGroupData[];
  currentUserId: string;
  sidebar: ReactNode;
}) {
  const [search, setSearch] = useState("");

  const filteredGroups = groups.map((g) => ({
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-72 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <CreateUserForm />
            <div className="space-y-4">
              {!anyResults && (
                <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
                  No users match &quot;{search}&quot;.
                </p>
              )}
              {filteredGroups.map((g) => (
                <RoleGroupSection key={g.key} group={g} currentUserId={currentUserId} />
              ))}
            </div>
          </div>

          <div className="space-y-4">{sidebar}</div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Assigning a user to a specific project (PM / CLIENT / LIMITED) happens on that project&apos;s Team tab, not
          here — role here is the global role only.
        </p>
      </main>
    </>
  );
}
