"use client";

import { useTransition } from "react";
import { setProjectStatus } from "./actions";
import type { ProjectStatus } from "@prisma/client";

export function ArchiveButton({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const [pending, startTransition] = useTransition();
  const isArchived = status === "ARCHIVED";

  return (
    <button
      onClick={(e) => {
        // The card itself is a <Link> to the project dashboard — this
        // button lives inside it, so clicking it must never navigate.
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => setProjectStatus(projectId, isArchived ? "ACTIVE" : "ARCHIVED"));
      }}
      disabled={pending}
      className="text-xs font-medium text-slate-400 hover:text-slate-700 disabled:opacity-50"
    >
      {pending ? "..." : isArchived ? "Unarchive" : "Archive"}
    </button>
  );
}
