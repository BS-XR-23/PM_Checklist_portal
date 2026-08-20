"use client";

import { useRef, useState, useTransition } from "react";
import { importPeopleCsv } from "./people-actions";

export function ImportPeopleButton() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
      >
        ⇧ Import People
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-80 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <p className="text-xs text-slate-500 mb-2">
            CSV or XLSX with Name / Title / Email / Phone / Rate Role / Competency columns. Rate Role and Competency
            are matched by name — unmatched values are just left blank.
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
              setNotice(null);
              const formData = new FormData();
              formData.set("file", file);
              startTransition(async () => {
                try {
                  const { importedCount, skippedDuplicateCount, unmatchedRoleCount, unmatchedCompetencyCount } = await importPeopleCsv(formData);
                  const issues: string[] = [];
                  if (skippedDuplicateCount > 0) issues.push(`skipped ${skippedDuplicateCount} with an email already in the registry`);
                  if (unmatchedRoleCount > 0) issues.push(`${unmatchedRoleCount} had a Rate Role that didn't match an existing one`);
                  if (unmatchedCompetencyCount > 0) issues.push(`${unmatchedCompetencyCount} had a Competency that didn't match an existing one`);
                  setNotice(
                    issues.length > 0
                      ? `Added ${importedCount} — ${issues.join("; ")}.`
                      : `Added ${importedCount} ${importedCount === 1 ? "person" : "people"}.`
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to import people.");
                } finally {
                  if (inputRef.current) inputRef.current.value = "";
                }
              });
            }}
            className="w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200 disabled:opacity-50"
          />
          {pending && <p className="text-xs text-slate-400 mt-1.5">Importing…</p>}
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
          {notice && <p className="text-xs text-emerald-700 mt-1.5">{notice}</p>}
        </div>
      )}
    </span>
  );
}
