"use client";

import { useRef, useState, useTransition } from "react";
import { uploadWbsTasks, deleteWbsTask } from "./delivery-actions";

export function UploadWbsTasksForm({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [duplicateTaskIds, setDuplicateTaskIds] = useState<string[]>([]);
  const [undoPending, startUndoTransition] = useTransition();
  const [undoDone, setUndoDone] = useState(false);

  return (
    <div className="mt-2 flex items-center gap-2">
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
          setDuplicateTaskIds([]);
          setUndoDone(false);
          const formData = new FormData();
          formData.set("file", file);
          startTransition(async () => {
            try {
              const { importedCount, skippedExactDuplicateCount, missingWbsCount, duplicateCount, duplicateTaskIds: dupIds } =
                await uploadWbsTasks(projectId, formData);
              const issues: string[] = [];
              if (skippedExactDuplicateCount > 0) issues.push(`skipped ${skippedExactDuplicateCount} exact duplicate${skippedExactDuplicateCount === 1 ? "" : "s"} (same WBS# and title)`);
              if (missingWbsCount > 0) issues.push(`WBS# wasn't recognized for ${missingWbsCount} of them — check the file's WBS# column header`);
              if (duplicateCount > 0) issues.push(`${duplicateCount} look like duplicates of tasks that already exist — look for the "dup?" flag below`);
              setNotice(
                issues.length > 0
                  ? `Imported ${importedCount} task${importedCount === 1 ? "" : "s"} — ${issues.join("; ")}.`
                  : `Imported ${importedCount} task${importedCount === 1 ? "" : "s"}.`
              );
              setDuplicateTaskIds(dupIds);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to upload tasks.");
            } finally {
              if (inputRef.current) inputRef.current.value = "";
            }
          });
        }}
        className="text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200 disabled:opacity-50"
      />
      {pending && <span className="text-xs text-slate-400">Uploading…</span>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className={missingWbsNoticeClass(notice)}>{notice}</p>}
      {duplicateTaskIds.length > 0 && !undoDone && (
        <button
          type="button"
          disabled={undoPending}
          onClick={() =>
            startUndoTransition(async () => {
              await Promise.all(duplicateTaskIds.map((id) => deleteWbsTask(id, projectId)));
              setUndoDone(true);
            })
          }
          className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {undoPending ? "Removing…" : `Remove ${duplicateTaskIds.length} duplicate import${duplicateTaskIds.length === 1 ? "" : "s"}`}
        </button>
      )}
      {undoDone && <span className="text-xs text-emerald-700">Duplicates removed.</span>}
    </div>
  );
}

function missingWbsNoticeClass(notice: string): string {
  const hasIssue = notice.includes("wasn't recognized") || notice.includes("look like duplicates") || notice.includes("skipped");
  return hasIssue ? "text-xs text-amber-700" : "text-xs text-emerald-700";
}
