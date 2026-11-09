import { prisma } from "@/lib/prisma";
import type { AccessLevel } from "@prisma/client";

/** One checklist's items in the shape ChecklistTable takes. Read Limited viewers don't get notes. */
export async function loadChecklistItems(projectId: string, type: string, access: AccessLevel) {
  const items = await prisma.checklistItem.findMany({
    where: { projectId, type },
    orderBy: { order: "asc" },
    include: {
      ownerPerson: { select: { id: true, name: true } },
      occurrences: {
        orderBy: { date: "desc" },
        select: { id: true, date: true, link: true, notes: true, recordedByName: true, sprint: { select: { name: true } } },
      },
    },
  });
  const hideNotes = access === "READ_LIMITED";

  return items.map(({ occurrences, ...i }) => ({
    ...i,
    notes: hideNotes ? null : i.notes,
    ownerPersonName: i.ownerPerson?.name ?? null,
    occurrences: occurrences.map(({ sprint, ...o }) => ({ ...o, notes: hideNotes ? null : o.notes, sprintName: sprint?.name ?? null })),
  }));
}
