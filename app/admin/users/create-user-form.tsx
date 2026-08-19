"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { IconUser } from "@/components/layout/icons";
import { createUser } from "./user-actions";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("LIMITED");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <IconUser className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Create User</h2>
          <p className="text-xs text-slate-500">Add a new user and assign a global role.</p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          startTransition(async () => {
            try {
              const { tempPassword } = await createUser(email, name, role);
              setResult({ email, tempPassword });
              setEmail("");
              setName("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create user.");
            }
          });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Creating..." : "Create User"}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
          Created {result.email}. Temporary password: <span className="font-mono font-semibold">{result.tempPassword}</span> — share this
          through a secure channel now, it won&apos;t be shown again.
        </div>
      )}
      <p className="text-xs text-slate-400">
        PM / CLIENT / LIMITED users see nothing until assigned to a project (that project&apos;s Team tab).
      </p>
    </div>
  );
}
