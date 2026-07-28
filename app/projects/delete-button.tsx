"use client";

import { useTransition } from "react";
import { deleteProject, restoreProject } from "./actions";

export function DeleteButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        // The card itself is a <Link> to the project dashboard — this
        // button lives inside it, so clicking it must never navigate.
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Delete this project? It can be restored later from the Deleted tab.")) return;
        startTransition(() => deleteProject(projectId));
      }}
      disabled={pending}
      className="text-xs font-medium text-red-400 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "..." : "Delete"}
    </button>
  );
}

export function RestoreButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => restoreProject(projectId));
      }}
      disabled={pending}
      className="text-xs font-medium text-slate-400 hover:text-slate-700 disabled:opacity-50"
    >
      {pending ? "..." : "Restore"}
    </button>
  );
}
