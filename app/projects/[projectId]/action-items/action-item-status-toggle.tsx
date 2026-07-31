"use client";

import { useTransition } from "react";
import { updateActionItem } from "./action-item-actions";

export function ActionItemStatusToggle({ id, projectId, status }: { id: string; projectId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const isDone = status === "Done";

  return (
    <button
      onClick={() => startTransition(() => updateActionItem(id, projectId, { status: isDone ? "Open" : "Done" }))}
      disabled={pending}
      className={
        isDone
          ? "inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
          : "inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
      }
      title={isDone ? "Mark as Open" : "Mark as Done"}
    >
      {pending ? "..." : isDone ? "✓ Done" : "Open"}
    </button>
  );
}
