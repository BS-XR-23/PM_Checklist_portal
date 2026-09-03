import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // Guessable URL — enforce the same module scoping as the page, not just "is logged in."
  const access = await getModuleAccess(params.projectId, "DEPENDENCIES");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const rows = await prisma.dependencyItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
  });

  const sheetRows = rows.map((d, i) => ({
    "No.": i + 1,
    Category: d.category ?? "",
    "Item Description": d.description,
    "Preferred Format(s)": d.preferredFormat ?? "",
    Responsible: d.responsible ?? "",
    Priority: d.priority,
    "Expected Date": formatDate(d.expectedDate),
    Status: d.status,
    Notes: d.notes ?? "",
  }));

  const buffer = buildXlsxBuffer("Dependencies", sheetRows);
  const filename = xlsxFilename(project.name, "Dependencies");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
