import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { compareWbsNumbers, formatDate, formatPct } from "@/lib/format";
import {
  liveSprintContribution,
  parseSprintContributions,
  sprintTotalsFromContributions,
  competencyCpi,
  type SprintTaskContribution,
} from "@/lib/calculations";
import { buildXlsxWorkbook, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "DELIVERY");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const sprints = await prisma.sprint.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "asc" },
    include: { tasks: { include: { person: { include: { roleRate: true } } } } },
  });

  const summaryRows: Record<string, unknown>[] = [];
  const taskRows: Record<string, unknown>[] = [];

  for (const s of sprints) {
    const departedEntries = parseSprintContributions(s.departedTaskSnapshot);
    const liveEntries = s.tasks.map(liveSprintContribution);
    const { plannedValue: pv, earnedValue: ev, actualValue: av } = s.closedAt
      ? { plannedValue: s.frozenPlannedPoints ?? 0, earnedValue: s.frozenEarnedPoints ?? 0, actualValue: s.frozenActualValue ?? 0 }
      : sprintTotalsFromContributions([...liveEntries, ...departedEntries]);
    const spi = pv ? ev / pv : null;
    const cpi = competencyCpi(ev, av);

    summaryRows.push({
      Sprint: s.name,
      "Start Date": formatDate(s.startDate),
      "End Date": formatDate(s.endDate),
      Status: s.closedAt ? "Closed" : "Open",
      PV: Number(pv.toFixed(2)),
      EV: Number(ev.toFixed(2)),
      AV: Number(av.toFixed(2)),
      SPI: spi == null ? "" : Number(spi.toFixed(2)),
      CPI: cpi == null ? "" : Number(cpi.toFixed(2)),
    });

    // Closed sprints read their permanent frozen snapshot, which folds a
    // departure in at close time with no separate marker for it (see
    // closeSprint in delivery-actions.ts) — "moved" is only knowable for an
    // open sprint, so a closed sprint's rows report "—" rather than a
    // guessed "No".
    const entries: (SprintTaskContribution & { moved: boolean | null })[] = s.closedAt
      ? (Array.isArray(s.frozenTaskSnapshot) ? (s.frozenTaskSnapshot as unknown as SprintTaskContribution[]) : []).map((e) => ({ ...e, moved: null }))
      : [...liveEntries.map((e) => ({ ...e, moved: false })), ...departedEntries.map((e) => ({ ...e, moved: true }))];

    for (const t of [...entries].sort((a, b) => compareWbsNumbers(a.wbsNumber, b.wbsNumber))) {
      taskRows.push({
        Sprint: s.name,
        "WBS#": t.wbsNumber,
        Title: t.title,
        "Story Points": t.storyPoints,
        "% Complete": formatPct(t.pctComplete),
        "Actual Hours (this sprint)": t.sprintOwnHours,
        "Moved to another sprint": t.moved === null ? "—" : t.moved ? "Yes" : "No",
      });
    }
  }

  const buffer = buildXlsxWorkbook([
    { name: "Sprint Summary", rows: summaryRows },
    { name: "Sprint Tasks", rows: taskRows },
  ]);
  const filename = xlsxFilename(project.name, "Sprints");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
