"use client";

import { useRef, useState, useTransition } from "react";
import { importUsersCsv } from "./user-actions";

export function ImportUsersButton() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof importUsersCsv>> | null>(null);
  const [copied, setCopied] = useState(false);

  function copyAll() {
    if (!result) return;
    const text = result.created.map((u) => `${u.email}\t${u.tempPassword}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
      >
        ⇧ Import Users
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-96 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg">
          {result ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Created {result.created.length} {result.created.length === 1 ? "user" : "users"}
                {result.skippedDuplicateCount > 0 && ` — skipped ${result.skippedDuplicateCount} with an email already in use`}
                {result.unmatchedRoleCount > 0 && ` — ${result.unmatchedRoleCount} had a Role that didn't match, defaulted to Guest`}.
              </p>
              {result.created.length > 0 && (
                <>
                  <p className="text-xs font-medium text-amber-700">
                    Temporary passwords — share these through a secure channel now, they won&apos;t be shown again.
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded border border-slate-200">
                    <table className="w-full text-xs">
                      <tbody>
                        {result.created.map((u) => (
                          <tr key={u.email} className="border-b border-slate-100 last:border-0">
                            <td className="px-2 py-1 text-slate-600 truncate max-w-[180px]">{u.email}</td>
                            <td className="px-2 py-1 font-mono font-semibold text-green-800">{u.tempPassword}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={copyAll}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copied ? "Copied!" : "Copy email + password list"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setOpen(false);
                }}
                className="w-full rounded bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2">
                CSV or XLSX with Name / Email / Role columns. Role must match an existing role name (e.g. &quot;PM&quot;,
                &quot;Client&quot;, &quot;Management&quot;) — unmatched or blank rows default to Guest. Rows whose email
                already exists are skipped.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError(null);
                  const formData = new FormData();
                  formData.set("file", file);
                  startTransition(async () => {
                    try {
                      const res = await importUsersCsv(formData);
                      setResult(res);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to import users.");
                    } finally {
                      if (inputRef.current) inputRef.current.value = "";
                    }
                  });
                }}
                className="w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200 disabled:opacity-50"
              />
              {pending && <p className="text-xs text-slate-400 mt-1.5">Importing…</p>}
              {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
            </>
          )}
        </div>
      )}
    </span>
  );
}
