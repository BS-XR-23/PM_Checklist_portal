"use client";

import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { setProjectStatus, deleteProject, restoreProject, permanentlyDeleteProject } from "./actions";
import type { ProjectStatus } from "@prisma/client";

/** Card corner "..." menu replacing the old inline Archive/Delete text
 * links — same underlying actions (setProjectStatus/deleteProject/etc.
 * from ./actions), just consolidated. The wrapping div's stopPropagation
 * keeps a click here from also triggering the card's own <Link> navigation
 * (RowActionsMenu's trigger and portaled panel both stop propagation
 * internally too, but the wrapper is cheap insurance and keeps this file
 * self-explanatory without reading into the shared component). */
export function ProjectActionsMenu({
  projectId,
  projectName,
  status,
  isDeleted,
}: {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  isDeleted: boolean;
}) {
  const isArchived = status === "ARCHIVED";

  const actions = isDeleted
    ? [
        { label: "Restore", onClick: () => restoreProject(projectId) },
        {
          label: "Delete Permanently",
          danger: true,
          confirmMessage: `Permanently delete "${projectName}"? This cannot be undone — all checklists, milestones, risks, and budget history are erased.`,
          onClick: () => permanentlyDeleteProject(projectId),
        },
      ]
    : [
        { label: isArchived ? "Unarchive" : "Archive", onClick: () => setProjectStatus(projectId, isArchived ? "ACTIVE" : "ARCHIVED") },
        {
          label: "Delete",
          danger: true,
          confirmMessage: `Delete "${projectName}"? It can be restored later from the Deleted tab.`,
          onClick: () => deleteProject(projectId),
        },
      ];

  return (
    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
      <RowActionsMenu actions={actions} />
    </div>
  );
}
