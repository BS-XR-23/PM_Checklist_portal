import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { compareWbsNumbers, formatPct } from "@/lib/format";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

// Mirrors delivery-tasks-table.tsx's taskStatusKey: a task reads as "In
// Progress" once it's sprint-committed, even before its % complete moves —
// duplicated here rather than imported since that function lives in a
// "use client" component file.
function taskStatus(t: { pctComplete: number; sprintId: string | null }): string {
  if (t.pctComplete >= 1) return "Completed";
  if (t.sprintId) return "In Progress";
  return "Not Started";
}

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "DELIVERY");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const [tasksRaw, sprints] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId: params.projectId } }),
    prisma.sprint.findMany({ where: { projectId: params.projectId }, select: { id: true, name: true } }),
  ]);

  const sprintNameById = new Map(sprints.map((s) => [s.id, s.name]));
  const tasks = [...tasksRaw].sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber));

  const sheetRows = tasks.map((t) => ({
    "WBS#": t.wbsNumber,
    Title: t.title,
    "Story Points": t.storyPoints,
    "% Complete": formatPct(t.pctComplete),
    "Actual Hours": t.actualHours,
    Assignee: t.personName ?? "",
    Sprint: t.sprintId ? (sprintNameById.get(t.sprintId) ?? "") : "Backlog",
    Status: taskStatus(t),
  }));

  const buffer = buildXlsxBuffer("WBS Tasks", sheetRows);
  const filename = xlsxFilename(project.name, "WBS_Tasks");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
