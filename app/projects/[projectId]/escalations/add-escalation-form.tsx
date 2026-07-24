"use client";

import { useState, useTransition } from "react";
import { createEscalation } from "./escalation-actions";

const TYPES = ["ALERT_ACK", "PORTFOLIO_RISK", "RESOURCE_CONFLICT"];

export function AddEscalationForm({ projectId }: { projectId: string }) {
  const [type, setType] = useState(TYPES[0]);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startTransition(async () => {
          await createEscalation(projectId, type, title);
          setTitle("");
        });
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[240px]">
        <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Adding..." : "Raise Escalation"}
      </button>
    </form>
  );
}
