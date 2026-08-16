"use client";

import { useRef, useState, useTransition } from "react";
import { uploadWbsTasks } from "./delivery-actions";

export function UploadWbsTasksForm({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          const formData = new FormData();
          formData.set("file", file);
          startTransition(async () => {
            try {
              await uploadWbsTasks(projectId, formData);
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
    </div>
  );
}
