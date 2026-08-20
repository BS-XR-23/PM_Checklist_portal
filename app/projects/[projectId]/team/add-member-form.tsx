"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { addProjectMember } from "./team-actions";

const ASSIGNABLE_ROLES: Role[] = ["PM", "CLIENT", "LIMITED"];

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("PM");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await addProjectMember(projectId, email, role);
            setEmail("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add member.");
          }
        });
      }}
      className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium text-slate-600 mb-1">User email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="someone@bs23.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Role on this project</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Adding..." : "Add to Team"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <p className="w-full text-xs text-slate-400">
        The user must already exist (Admin &gt; Users) — this only assigns them to this project. CLIENT gets a
        locked-down default view immediately; LIMITED starts with no access until configured below.
      </p>
    </form>
  );
}
