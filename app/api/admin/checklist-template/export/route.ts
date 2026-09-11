import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/rbac";
import { buildXlsxBuffer } from "@/lib/xlsx-export";
import { CHECKLIST_TYPES, templateStagesFor } from "@/lib/checklist-types";

function xlsxResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ?type=PM|ENGINEERING|QA|DEVOPS|CREATIVE_XR|DEV exports that checklist's
// template; ?type=PRESALES exports the separate presales template (its own
// model — no stages, no milestone column).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("Not found", { status: 404 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");

  if (typeParam === "PRESALES") {
    const items = await prisma.presalesChecklistTemplateItem.findMany({ orderBy: { order: "asc" } });
    const sheetRows = items.map((item, idx) => ({ "#": idx + 1, "Item Text": item.itemText }));
    return xlsxResponse(buildXlsxBuffer("Presales Checklist", sheetRows), "Presales_Checklist_Template.xlsx");
  }

  const config = CHECKLIST_TYPES.find((c) => c.key === typeParam);
  if (!config) return new NextResponse("Not found", { status: 404 });

  const items = await prisma.checklistTemplateItem.findMany({
    where: { type: config.key },
    orderBy: { order: "asc" },
  });
  const stages = templateStagesFor(config);

  const sheetRows: Record<string, unknown>[] = [];
  stages.forEach((stage, stageIdx) => {
    items
      .filter((item) => item.stage === stage)
      .forEach((item, itemIdx) => {
        sheetRows.push({
          "#": `${stageIdx + 1}.${itemIdx + 1}`,
          Section: stage,
          "Item Text": item.itemText,
          Milestone: item.milestoneName ?? "",
          Type: item.milestoneName ? "Milestone" : "Task",
        });
      });
  });

  const buffer = buildXlsxBuffer(config.label.slice(0, 31), sheetRows);
  const filename = `${config.label.replace(/[^a-z0-9]+/gi, "_")}_Template.xlsx`;
  return xlsxResponse(buffer, filename);
}
