import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { riskScore } from "@/lib/calculations";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "RISK_REGISTER");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const rows = await prisma.riskItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
    include: { ownerPerson: { select: { name: true } } },
  });

  const sheetRows = rows.map((r, i) => ({
    "No.": i + 1,
    Type: r.type,
    Category: r.category ?? "",
    "Risk / Issue": r.description,
    Probability: r.probability,
    Impact: r.impact,
    "Risk Score": riskScore(r.probability, r.impact),
    Owner: r.ownerPerson?.name ?? r.owner ?? "",
    Mitigation: r.mitigation ?? "",
    Status: r.status,
    "Date Raised": formatDate(r.dateRaised),
    "Date Closed": formatDate(r.dateClosed),
    Notes: r.notes ?? "",
  }));

  const buffer = buildXlsxBuffer("Risk Register", sheetRows);
  const filename = xlsxFilename(project.name, "Risk_Register");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
