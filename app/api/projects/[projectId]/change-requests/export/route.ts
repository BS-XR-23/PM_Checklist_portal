import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleAccess, meetsLevel } from "@/lib/rbac";
import { formatDate, formatMoney } from "@/lib/format";
import { crAmount } from "@/lib/calculations";
import { buildXlsxBuffer, xlsxFilename } from "@/lib/xlsx-export";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const access = await getModuleAccess(params.projectId, "CR_LOG");
  if (!meetsLevel(access, "READ_LIMITED")) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Same Rate/Amount hiding as the page for a READ_LIMITED viewer (e.g. a
  // Client) — this is a guessable URL, so it must not leak financials the
  // UI itself hides.
  const financialsHidden = access === "READ_LIMITED";

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return new NextResponse("Not found", { status: 404 });

  const rows = await prisma.changeRequest.findMany({
    where: { projectId: params.projectId },
    orderBy: { dateRaised: "asc" },
  });

  const sheetRows = rows.map((c) => ({
    "CR Code": c.crCode,
    Title: c.title,
    "Date Raised": formatDate(c.dateRaised),
    Description: c.description ?? "",
    "Man-Days Planned": c.manDaysPlanned ?? "",
    "Billable Man-Days": c.billableManDays ?? "",
    ...(financialsHidden
      ? {}
      : {
          Rate: c.rate ?? "",
          Amount: (() => {
            const amount = crAmount(c.billableManDays, c.rate);
            return amount == null ? "" : formatMoney(amount);
          })(),
        }),
    Type: c.type,
    "Client Sign-off": c.clientSignoff,
    "WBS Updated": c.wbsUpdated,
    Status: c.status,
    Notes: c.notes ?? "",
  }));

  const buffer = buildXlsxBuffer("CR Log", sheetRows);
  const filename = xlsxFilename(project.name, "CR_Log");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
