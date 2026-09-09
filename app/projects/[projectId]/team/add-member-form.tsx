"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { IconUserPlus } from "@/components/layout/icons";
import { ROLE_LABELS } from "@/lib/constants";
import { addProjectMember } from "./team-actions";

const ASSIGNABLE_ROLES: Role[] = ["PM", "CLIENT", "LIMITED"];

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("PM");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
          <IconUserPlus className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Add to Team</h2>
          <p className="text-xs text-slate-500">Assign an existing user to this project with a project-level role.</p>
        </div>
      </div>
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
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">User email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@bs23.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Role on this project</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add to Team"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        The user must already exist (Admin &gt; Users) — this only assigns them to this project. Client gets a
        locked-down default view immediately; Guest starts at Read Limited across the board — both are adjustable
        below.
      </p>
    </div>
  );
}
