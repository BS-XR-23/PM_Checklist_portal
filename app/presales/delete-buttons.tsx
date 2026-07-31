"use client";

import { useTransition } from "react";
import { deletePresalesProject, restorePresalesProject, permanentlyDeletePresalesProject } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Delete this presales opportunity? It can be restored later from the Deleted filter.")) return;
        startTransition(() => deletePresalesProject(id));
      }}
      disabled={pending}
      className="text-xs font-medium text-red-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}

export function RestoreButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => restorePresalesProject(id));
      }}
      disabled={pending}
      className="text-xs font-medium text-slate-400 hover:text-slate-700 disabled:opacity-50"
    >
      {pending ? "..." : "Restore"}
    </button>
  );
}

export function PermanentDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Permanently delete this presales opportunity? This cannot be undone.")) return;
        startTransition(() => permanentlyDeletePresalesProject(id));
      }}
      disabled={pending}
      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "..." : "Delete Permanently"}
    </button>
  );
}
