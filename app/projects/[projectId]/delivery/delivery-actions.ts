"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateDelivery(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/delivery/tasks`);
}

export async function createWbsWeek(projectId: string) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const last = await prisma.wbsWeek.findFirst({ where: { projectId }, orderBy: { weekEnding: "desc" } });
  const nextWeek = last ? new Date(last.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();

  const created = await prisma.wbsWeek.create({ data: { projectId, weekEnding: nextWeek } });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "WbsWeek", entityId: created.id, summary: "Added a weekly WBS entry" });
  revalidateDelivery(projectId);
}

export async function addWbsTask(wbsWeekId: string, _projectId: string) {
  const week = await prisma.wbsWeek.findUniqueOrThrow({ where: { id: wbsWeekId } });
  const user = await requireModuleWrite(week.projectId, "DELIVERY");

  const created = await prisma.wbsTask.create({
    data: { wbsWeekId, wbsNumber: "", title: "New task", manDays: 0, pctComplete: 0, actualManDays: 0 },
  });

  await writeAudit({ actor: user, projectId: week.projectId, action: "create", entityType: "WbsTask", entityId: created.id, summary: "Added a WBS task" });
  revalidateDelivery(week.projectId);
}

export async function updateWbsTask(
  id: string,
  _projectId: string,
  data: Partial<{ wbsNumber: string; title: string; manDays: number; pctComplete: number; actualManDays: number; personId: string | null }>
) {
  // Guessed-ID fix: authorize against the task's real project via its week.
  const existing = await prisma.wbsTask.findUniqueOrThrow({ where: { id }, include: { wbsWeek: true } });
  const user = await requireModuleWrite(existing.wbsWeek.projectId, "DELIVERY");

  // Choosing a person re-snapshots personName/competencyMultiplier from
  // their current Competency — a later Competency edit must never rewrite
  // this task's already-recorded Actual Value. Must actually be engaged on
  // this project (never trust the client-side roster filter as the real
  // boundary). No Competency set means baseline (1.0), not an error — not
  // every assignee needs to be rated to be assigned.
  let personFields: { personId?: string | null; personName?: string | null; competencyMultiplier?: number } = {};
  if (data.personId !== undefined) {
    if (data.personId === null) {
      personFields = { personId: null, personName: null, competencyMultiplier: 1 };
    } else {
      const person = await prisma.person.findUniqueOrThrow({ where: { id: data.personId }, include: { competency: true } });
      const engaged = await prisma.projectEngagement.findFirst({ where: { personId: person.id, projectId: existing.wbsWeek.projectId } });
      if (!engaged) throw new Error(`${person.name} isn't engaged on this project — assign them on the Team → Engagement tab first.`);
      personFields = { personId: person.id, personName: person.name, competencyMultiplier: person.competency?.multiplier ?? 1 };
    }
  }

  await prisma.wbsTask.update({
    where: { id },
    data: {
      ...(data.wbsNumber !== undefined ? { wbsNumber: data.wbsNumber } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.manDays !== undefined ? { manDays: data.manDays } : {}),
      ...(data.pctComplete !== undefined ? { pctComplete: data.pctComplete } : {}),
      ...(data.actualManDays !== undefined ? { actualManDays: data.actualManDays } : {}),
      ...personFields,
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.wbsWeek.projectId,
    action: "update",
    entityType: "WbsTask",
    entityId: id,
    summary: "Updated a WBS task",
    diff: { before: existing, changes: data },
  });

  revalidateDelivery(existing.wbsWeek.projectId);
}

export async function deleteWbsTask(id: string, _projectId: string) {
  const existing = await prisma.wbsTask.findUniqueOrThrow({ where: { id }, include: { wbsWeek: true } });
  const user = await requireModuleWrite(existing.wbsWeek.projectId, "DELIVERY");

  await prisma.wbsTask.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.wbsWeek.projectId,
    action: "delete",
    entityType: "WbsTask",
    entityId: id,
    summary: "Deleted a WBS task",
    diff: { before: existing },
  });

  revalidateDelivery(existing.wbsWeek.projectId);
}

type UploadRow = { wbsNumber: string; title: string; manDays: number; pctComplete: number; actualManDays: number; assignee: string | null };

/** Header aliases so a PM's existing spreadsheet columns (matching the
 * VUMI-style sheet reviewed earlier) work without renaming anything first. */
const HEADER_ALIASES: Record<string, keyof UploadRow> = {
  "wbs#": "wbsNumber",
  wbs: "wbsNumber",
  "wbs number": "wbsNumber",
  title: "title",
  task: "title",
  "man days": "manDays",
  "man-days": "manDays",
  mandays: "manDays",
  "%": "pctComplete",
  pct: "pctComplete",
  "% complete": "pctComplete",
  "actual man days": "actualManDays",
  "actual man-days": "actualManDays",
  "actual mandays": "actualManDays",
  assignee: "assignee",
  person: "assignee",
};

function parseUploadRows(buffer: ArrayBuffer): UploadRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return raw
    .map((rawRow) => {
      const row: Partial<UploadRow> = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const field = HEADER_ALIASES[key.trim().toLowerCase()];
        if (!field) continue;
        if (field === "wbsNumber" || field === "title" || field === "assignee") {
          const s = String(value).trim();
          (row as Record<string, unknown>)[field] = s || (field === "assignee" ? null : "");
        } else {
          // "%" columns may arrive as "70%" (string) or 70 (already a whole percent) — normalize to a 0..1 fraction.
          const n = typeof value === "number" ? value : Number(String(value).replace("%", "").trim());
          const normalized = field === "pctComplete" && !Number.isNaN(n) && n > 1 ? n / 100 : n;
          (row as Record<string, unknown>)[field] = Number.isNaN(normalized) ? 0 : normalized;
        }
      }
      return {
        wbsNumber: row.wbsNumber ?? "",
        title: row.title ?? "",
        manDays: row.manDays ?? 0,
        pctComplete: row.pctComplete ?? 0,
        actualManDays: row.actualManDays ?? 0,
        assignee: row.assignee ?? null,
      };
    })
    .filter((r) => r.title !== ""); // skip fully-blank trailing rows
}

export async function uploadWbsTasks(wbsWeekId: string, _projectId: string, formData: FormData) {
  const week = await prisma.wbsWeek.findUniqueOrThrow({ where: { id: wbsWeekId } });
  const user = await requireModuleWrite(week.projectId, "DELIVERY");

  // `instanceof Blob`, not `File` — Node has no global File constructor,
  // and a plain Blob (as constructed in tests) is all `.arrayBuffer()`
  // actually needs; `.name` is read defensively below since only File has it.
  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "upload";

  const buffer = await file.arrayBuffer();
  const rows = parseUploadRows(buffer);
  if (rows.length === 0) throw new Error("No rows found in the uploaded file — check it has WBS#/Title/Man-days/% columns.");

  // Assignee matches by exact Person.name (case-insensitive) among people
  // actually engaged on this project. No match leaves the row unassigned
  // rather than failing the whole upload — a name typo shouldn't block
  // everyone else's rows from importing.
  const engagements = await prisma.projectEngagement.findMany({
    where: { projectId: week.projectId },
    include: { person: { include: { competency: true } } },
  });
  const byName = new Map(engagements.map((e) => [e.person.name.trim().toLowerCase(), e.person]));

  await prisma.wbsTask.createMany({
    data: rows.map((r) => {
      const person = r.assignee ? byName.get(r.assignee.trim().toLowerCase()) : undefined;
      return {
        wbsWeekId,
        wbsNumber: r.wbsNumber,
        title: r.title,
        manDays: r.manDays,
        pctComplete: r.pctComplete,
        actualManDays: r.actualManDays,
        personId: person?.id ?? null,
        personName: person?.name ?? null,
        competencyMultiplier: person?.competency?.multiplier ?? 1,
      };
    }),
  });

  await writeAudit({
    actor: user,
    projectId: week.projectId,
    action: "create",
    entityType: "WbsTask",
    summary: `Uploaded ${rows.length} WBS task${rows.length === 1 ? "" : "s"} from ${fileName}`,
  });

  revalidateDelivery(week.projectId);
}
