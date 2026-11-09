import { prisma } from "@/lib/prisma";
import { buildQmsReport, type QmsReport } from "@/lib/qms";

/** Everything QMS reads for one project. Shared by the QMS Audit tab and its export. */
export async function loadQmsReport(projectId: string): Promise<QmsReport> {
  const [items, crs] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId, NOT: { qmsRefs: { isEmpty: true } } },
      orderBy: { order: "asc" },
      include: {
        ownerPerson: { select: { name: true } },
        occurrences: { select: { date: true, link: true } },
      },
    }),
    prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { crCode: "asc" },
      select: { crCode: true, title: true, status: true, clientSignoff: true, wbsUpdated: true, documentLink: true },
    }),
  ]);

  return buildQmsReport(
    items.map((i) => ({
      id: i.id,
      type: i.type,
      itemText: i.itemText,
      status: i.status,
      isRecurring: i.isRecurring,
      link: i.link,
      actualDate: i.actualDate,
      ownerName: i.ownerPerson?.name ?? i.owner,
      notes: i.notes,
      qmsRefs: i.qmsRefs,
      occurrences: i.occurrences,
    })),
    crs
  );
}
