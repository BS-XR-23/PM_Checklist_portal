import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "DECISION_LOG");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const rows = await prisma.decisionLogItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
    include: { decidedByPerson: { select: { name: true } } },
  });

  const sheetRows = rows.map((d, i) => ({
    "No.": i + 1,
    Date: formatDate(d.date),
    Decision: d.decision,
    Rationale: d.rationale ?? "",
    "Decided By": d.decidedByPerson?.name ?? d.decidedBy ?? "",
    Notes: d.notes ?? "",
  }));

  const buffer = buildXlsxBuffer("Decision Log", sheetRows);
  const filename = xlsxFilename(project.name, "Decision_Log");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
