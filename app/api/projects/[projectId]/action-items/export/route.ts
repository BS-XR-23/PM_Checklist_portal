import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "ACTION_ITEMS");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const rows = await prisma.actionItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
    include: { ownerPerson: { select: { name: true } } },
  });

  const sheetRows = rows.map((a, i) => ({
    "No.": i + 1,
    Description: a.description,
    Owner: a.ownerPerson?.name ?? a.owner ?? "",
    "Due Date": formatDate(a.dueDate),
    Status: a.status,
    Notes: a.notes ?? "",
  }));

  const buffer = buildXlsxBuffer("Action Items", sheetRows);
  const filename = xlsxFilename(project.name, "Action_Items");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
