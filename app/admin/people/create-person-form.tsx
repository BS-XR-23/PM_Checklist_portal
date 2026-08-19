"use client";

import { useState, useTransition } from "react";
import { IconUser } from "@/components/layout/icons";
import { createPerson } from "./people-actions";

export function CreatePersonForm({
  linkableUsers,
  roleRates,
  competencies,
}: {
  linkableUsers: { id: string; name: string; email: string }[];
  roleRates: { id: string; roleName: string }[];
  competencies: { id: string; level: string }[];
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [roleRateId, setRoleRateId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div id="add-person" className="rounded-xl border border-slate-200 bg-white overflow-hidden scroll-mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <IconUser className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Add Person</h2>
          <p className="text-xs text-slate-500">Add a team member and set their rate role and competency.</p>
        </div>
        <span className={`text-slate-400 text-xs transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
      </button>
      {!collapsed && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              await createPerson({
                name,
                title,
                email,
                phone,
                userId: userId || undefined,
                roleRateId: roleRateId || undefined,
                competencyId: competencyId || undefined,
              });
              setName("");
              setTitle("");
              setEmail("");
              setPhone("");
              setUserId("");
              setRoleRateId("");
              setCompetencyId("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create person.");
            }
          });
        }}
        className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100"
      >
        <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lead Engineer"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portal Account (optional)</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {linkableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
          <div>
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Competency (optional)</label>
            <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.level}
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
      )}
    </div>
  );
}
