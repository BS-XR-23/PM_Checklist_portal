import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { canViewQms, qmsSheetRows } from "@/lib/qms";
import { loadQmsReport } from "@/lib/qms-data";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // Same rule as the tab: this is a guessable URL, so it checks for itself.
  const [user, access] = await Promise.all([getCurrentUser(), getModuleAccess(params.projectId, "PM_CHECKLIST")]);
  if (!user || !canViewQms(user.role) || !meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project || project.deletedAt) return new NextResponse("Not found", { status: 404 });

  const report = await loadQmsReport(params.projectId);
  const buffer = buildXlsxBuffer("QMS Audit", qmsSheetRows(report, formatDate));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${xlsxFilename(project.name, "QMS_Audit")}"`,
    },
  });
}
