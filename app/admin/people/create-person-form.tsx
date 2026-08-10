"use client";

import { useState, useTransition } from "react";
import { createPerson } from "./people-actions";

export function CreatePersonForm({
  linkableUsers,
  roleRates,
}: {
  linkableUsers: { id: string; name: string; email: string }[];
  roleRates: { id: string; roleName: string }[];
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [roleRateId, setRoleRateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createPerson({ name, title, email, phone, userId: userId || undefined, roleRateId: roleRateId || undefined });
            setName("");
            setTitle("");
            setEmail("");
            setPhone("");
            setUserId("");
            setRoleRateId("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create person.");
          }
        });
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">Add Person</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lead Engineer"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Linked portal account (optional)</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">None</option>
            {linkableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Rate Role (optional)</label>
          <select value={roleRateId} onChange={(e) => setRoleRateId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">None</option>
            {roleRates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roleName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Adding..." : "Add Person"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        Link a portal account only for people who log in themselves (typically LIMITED role) — that&apos;s what
        drives their own &quot;My Engagement&quot; self-service view.
      </p>
    </form>
  );
}
