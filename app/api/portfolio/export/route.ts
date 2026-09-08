import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/rbac";
import { RAG_COLORS } from "@/lib/rag";
import { formatShortDate } from "@/lib/format";
import { buildXlsxBuffer } from "@/lib/xlsx-export";
import { PORTFOLIO_PROJECT_INCLUDE, buildPortfolioData } from "@/lib/portfolio-data";

export async function GET(_req: NextRequest) {
  // Same role scope as app/portfolio/page.tsx — guessable URL, so re-check
  // here rather than trusting that only an authorized nav link reaches it.
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: PORTFOLIO_PROJECT_INCLUDE,
  });

  const { rows } = buildPortfolioData(projects);

  const sheetRows = rows.map((r) => ({
    Project: r.name,
    Client: r.client ?? "",
    PM: r.pmName ?? "",
    Stage: r.stage,
    Health: RAG_COLORS[r.rag].label === "Green" ? "Healthy" : RAG_COLORS[r.rag].label === "Amber" ? "At Risk" : "Critical",
    "Progress %": Math.round(r.progress * 100),
    "Contract Value": r.contractValue,
    SPI: r.latestSpi ?? "",
    CPI: r.latestCpi ?? "",
    "Open Risks": r.openRisks,
    "Next Milestone": r.nextMilestone ? `${formatShortDate(r.nextMilestone.date)} — ${r.nextMilestone.name}` : "",
    "Contract Status": r.status,
  }));

  const buffer = buildXlsxBuffer("Portfolio", sheetRows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Portfolio_Export.xlsx"`,
    },
  });
}
