"use client";

import { useState, useTransition } from "react";
import { RELEASE_TYPES, RELEASE_TYPE_LABELS } from "@/lib/constants";
import { createRelease } from "./release-actions";
import type { ReleaseType } from "@prisma/client";

export function AddReleaseModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ReleaseType>("INTERNAL");
  const [environment, setEnvironment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 shrink-0"
      >
        + Add Release
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add Release</h3>
        <p className="text-xs text-slate-500">A version/build being shipped — e.g. &quot;1.4.0 deployed to UAT&quot;.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Version</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.4.0"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReleaseType)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              {RELEASE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RELEASE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Release Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beta Release"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Environment</label>
          <input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="e.g. UAT, Production"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await createRelease(projectId, { version: version.trim(), name: name.trim() || "New Release", type, environment: environment.trim() || null });
                  setOpen(false);
                  setVersion("");
                  setName("");
                  setEnvironment("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add release.");
                }
              })
            }
            disabled={pending || !version.trim()}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add Release"}
          </button>
        </div>
      </div>
    </div>
  );
}
