import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderPmPlanDocx } from "@/lib/pm-plan-docx";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // This is a guessable URL (/api/projects/<id>/pm-plan/export) — it must
  // enforce the same module scoping as the page, not just "is logged in."
  const access = await getModuleAccess(params.projectId, "PM_PLAN");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const pmPlan = await prisma.pMPlan.findUnique({
    where: { projectId: params.projectId },
    include: { stakeholders: true, commsRows: true, raciRows: true },
  });
  if (!pmPlan) return new NextResponse("PM Plan not found", { status: 404 });

  const buffer = renderPmPlanDocx({
    project,
    pmPlan,
    stakeholders: pmPlan.stakeholders,
    comms: pmPlan.commsRows,
    raci: pmPlan.raciRows,
  });

  const filename = `PM_Plan_${project.name.replace(/[^a-z0-9]+/gi, "_")}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
