"use client";

import { useTransition } from "react";
import { createPresalesChecklistItem } from "./checklist-actions";

export function AddPresalesChecklistItemButton({ presalesProjectId }: { presalesProjectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => createPresalesChecklistItem(presalesProjectId))}
      disabled={pending}
      className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-50"
    >
      {pending ? "Adding..." : "+ Add Item"}
    </button>
  );
}
