"use client";

import { useTransition } from "react";
import { createBudgetEntry } from "./budget-actions";

export function AddEntryButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => createBudgetEntry(projectId))}
      disabled={pending}
      className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50 shrink-0"
    >
      + Add Week
    </button>
  );
}
