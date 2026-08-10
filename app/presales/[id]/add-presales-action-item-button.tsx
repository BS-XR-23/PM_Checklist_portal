"use client";

import { useTransition } from "react";
import { createPresalesActionItem } from "./action-item-actions";

export function AddPresalesActionItemButton({ presalesProjectId }: { presalesProjectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => createPresalesActionItem(presalesProjectId))}
      disabled={pending}
      className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50 shrink-0"
    >
      + Add Action Item
    </button>
  );
}
