"use client";

import { useTransition } from "react";
import { createChangeRequest } from "./cr-actions";

export function AddCrButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => createChangeRequest(projectId))}
      disabled={pending}
      className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50 shrink-0"
    >
      + Add CR
    </button>
  );
}
