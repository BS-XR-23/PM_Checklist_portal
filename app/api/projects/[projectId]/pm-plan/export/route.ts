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

  // Risks/Dependencies/Milestones are separate RBAC modules from PM_PLAN —
  // only include them in the export if this viewer actually has access to
  // those tabs too, same rule the page itself applies. Deliverables/
  // Resources/Gates have no separate module (PMPlan-owned data), so they
  // follow PM_PLAN access alone, same as Stakeholders/Comms/RACI below.
  const [riskAccess, depAccess, deliveryAccess] = await Promise.all([
    getModuleAccess(params.projectId, "RISK_REGISTER"),
    getModuleAccess(params.projectId, "DEPENDENCIES"),
    getModuleAccess(params.projectId, "DELIVERY"),
  ]);
  const canSeeRisks = meetsLevel(riskAccess, "READ_LIMITED");
  const canSeeDeps = meetsLevel(depAccess, "READ_LIMITED");
  const canSeeMilestones = meetsLevel(deliveryAccess, "READ_LIMITED");

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const pmPlan = await prisma.pMPlan.findUnique({
    where: { projectId: params.projectId },
    include: { stakeholders: true, commsRows: true, raciRows: true, deliverableRows: true, timelineRows: true, resourceRows: true, gateRows: true },
  });
  if (!pmPlan) return new NextResponse("PM Plan not found", { status: 404 });

  const [risks, dependencies, milestones] = await Promise.all([
    canSeeRisks ? prisma.riskItem.findMany({ where: { projectId: params.projectId }, orderBy: { order: "asc" } }) : Promise.resolve([]),
    canSeeDeps ? prisma.dependencyItem.findMany({ where: { projectId: params.projectId }, orderBy: { order: "asc" } }) : Promise.resolve([]),
    canSeeMilestones
      ? prisma.milestone.findMany({
          where: { projectId: params.projectId },
          orderBy: { plannedDate: "asc" },
          include: { ownerPerson: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const buffer = renderPmPlanDocx({
    project,
    pmPlan,
    stakeholders: pmPlan.stakeholders,
    comms: pmPlan.commsRows,
    raci: pmPlan.raciRows,
    risks,
    dependencies,
    milestones,
    deliverables: pmPlan.deliverableRows,
    timeline: pmPlan.timelineRows,
    resources: pmPlan.resourceRows,
    gates: pmPlan.gateRows,
  });

  const filename = `PM_Plan_${project.name.replace(/[^a-z0-9]+/gi, "_")}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
