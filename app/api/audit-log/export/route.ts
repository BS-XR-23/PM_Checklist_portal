import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/rbac";
import { buildXlsxBuffer } from "@/lib/xlsx-export";
import type { Prisma } from "@prisma/client";

// Safety valve on a shared DB pool — well beyond anything a real filtered
// export needs day-to-day; an unfiltered pull just gets truncated to the
// most recent slice rather than pulling the whole table into memory.
const MAX_ROWS = 10_000;
const MAX_DIFF_CELL_LENGTH = 30_000; // Excel's per-cell character cap is 32,767

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(req: NextRequest) {
  // Same role scope as app/admin/audit-log/page.tsx — guessable URL, so
  // re-check here rather than trusting that only an authorized nav link reaches it.
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const projectId = params.get("projectId") || undefined;
  const actorId = params.get("actorId") || undefined;
  const action = params.get("action") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(projectId ? { projectId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: endOfDay(to) } : {}),
          },
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: true, project: true },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const sheetRows = logs.map((l) => {
    const diffText = l.diff ? JSON.stringify(l.diff) : "";
    return {
      When: l.createdAt.toISOString(),
      Actor: l.actor.name,
      "Actor Email": l.actor.email,
      Role: l.actorRole,
      Project: l.project?.name ?? "",
      Action: l.action,
      "Entity Type": l.entityType,
      "Entity ID": l.entityId ?? "",
      Summary: l.summary,
      Override: l.isOverride ? "Yes" : "No",
      Diff: diffText.length > MAX_DIFF_CELL_LENGTH ? `${diffText.slice(0, MAX_DIFF_CELL_LENGTH)}…` : diffText,
    };
  });

  const buffer = buildXlsxBuffer("Audit Log", sheetRows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Audit_Log_Export.xlsx"`,
    },
  });
}
