"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidateDelivery(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/delivery/tasks`);
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

async function resolvePerson(projectId: string, personId: string) {
  const person = await prisma.person.findUniqueOrThrow({ where: { id: personId }, include: { competency: true } });
  const engaged = await prisma.projectEngagement.findFirst({ where: { personId: person.id, projectId } });
  if (!engaged) throw new Error(`${person.name} isn't engaged on this project — assign them on the Team → Engagement tab first.`);
  return person;
}

// --- Master WBS (Tasks tab) ---

export async function createWbsTask(projectId: string) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const created = await prisma.wbsTask.create({
    data: { projectId, wbsNumber: "", title: "New task", manDays: 0 },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "WbsTask", entityId: created.id, summary: "Added a WBS task" });
  revalidateDelivery(projectId);
}

export async function updateWbsTask(
  id: string,
  _projectId: string,
  data: Partial<{ wbsNumber: string; title: string; manDays: number; personId: string | null }>
) {
  const existing = await prisma.wbsTask.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  let personFields: { personId?: string | null; personName?: string | null } = {};
  if (data.personId !== undefined) {
    if (data.personId === null) {
      personFields = { personId: null, personName: null };
    } else {
      const person = await resolvePerson(existing.projectId, data.personId);
      personFields = { personId: person.id, personName: person.name };
    }
  }

  await prisma.wbsTask.update({
    where: { id },
    data: {
      ...(data.wbsNumber !== undefined ? { wbsNumber: data.wbsNumber } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.manDays !== undefined ? { manDays: data.manDays } : {}),
      ...personFields,
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "WbsTask",
    entityId: id,
    summary: "Updated a WBS task",
    diff: { before: existing, changes: data },
  });

  revalidateDelivery(existing.projectId);
}

export async function deleteWbsTask(id: string, _projectId: string) {
  const existing = await prisma.wbsTask.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  const entryCount = await prisma.wbsWeekEntry.count({ where: { wbsTaskId: id } });
  if (entryCount > 0) {
    throw new Error(`This task has logged progress in ${entryCount} week${entryCount === 1 ? "" : "s"} — remove those entries first.`);
  }

  await prisma.wbsTask.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "WbsTask",
    entityId: id,
    summary: "Deleted a WBS task",
    diff: { before: existing },
  });

  revalidateDelivery(existing.projectId);
}

type UploadRow = { wbsNumber: string; title: string; manDays: number; assignee: string | null };

/** Header aliases so a PM's existing spreadsheet columns work without renaming anything first. */
const HEADER_ALIASES: Record<string, keyof UploadRow> = {
  "wbs#": "wbsNumber",
  wbs: "wbsNumber",
  "wbs number": "wbsNumber",
  title: "title",
  task: "title",
  "man days": "manDays",
  "man-days": "manDays",
  mandays: "manDays",
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
          const n = typeof value === "number" ? value : Number(String(value).trim());
          (row as Record<string, unknown>)[field] = Number.isNaN(n) ? 0 : n;
        }
      }
      return {
        wbsNumber: row.wbsNumber ?? "",
        title: row.title ?? "",
        manDays: row.manDays ?? 0,
        assignee: row.assignee ?? null,
      };
    })
    .filter((r) => r.title !== ""); // skip fully-blank trailing rows
}

export async function uploadWbsTasks(projectId: string, formData: FormData) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "upload";

  const buffer = await file.arrayBuffer();
  const rows = parseUploadRows(buffer);
  if (rows.length === 0) throw new Error("No rows found in the uploaded file — check it has WBS#/Title/Man-days columns.");

  // Assignee matches by exact Person.name (case-insensitive) among people
  // actually engaged on this project. No match leaves the row unassigned
  // rather than failing the whole upload — a name typo shouldn't block
  // everyone else's rows from importing.
  const engagements = await prisma.projectEngagement.findMany({ where: { projectId }, include: { person: true } });
  const byName = new Map(engagements.map((e) => [e.person.name.trim().toLowerCase(), e.person]));

  await prisma.wbsTask.createMany({
    data: rows.map((r) => {
      const person = r.assignee ? byName.get(r.assignee.trim().toLowerCase()) : undefined;
      return {
        projectId,
        wbsNumber: r.wbsNumber,
        title: r.title,
        manDays: r.manDays,
        personId: person?.id ?? null,
        personName: person?.name ?? null,
      };
    }),
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "WbsTask",
    summary: `Uploaded ${rows.length} WBS task${rows.length === 1 ? "" : "s"} from ${fileName}`,
  });

  revalidateDelivery(projectId);
}

// --- Weekly tracking (Weekly CPI tab) ---

export async function createWbsWeek(projectId: string, weekEnding: string | null) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const parsed = weekEnding ? parseDateInput(weekEnding) : null;
  const resolvedDate =
    parsed ??
    (await (async () => {
      const last = await prisma.wbsWeek.findFirst({ where: { projectId }, orderBy: { weekEnding: "desc" } });
      return last ? new Date(last.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();
    })());

  const created = await prisma.wbsWeek.create({ data: { projectId, weekEnding: resolvedDate } });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "WbsWeek", entityId: created.id, summary: "Added a tracking week" });
  revalidateDelivery(projectId);
}

/** Fixes a mistyped week-ending date after the fact — the week's rows and
 * everything derived from it (Weekly CPI, Budget Tracker) stay attached,
 * only the date moves. */
export async function updateWbsWeek(id: string, _projectId: string, weekEnding: string) {
  const existing = await prisma.wbsWeek.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  const parsed = parseDateInput(weekEnding);
  if (!parsed) throw new Error("A valid date is required.");

  try {
    await prisma.wbsWeek.update({ where: { id }, data: { weekEnding: parsed } });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      throw new Error("This project already has a tracking week ending on that date.");
    }
    throw err;
  }

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "WbsWeek",
    entityId: id,
    summary: "Corrected a tracking week's date",
    diff: { before: { weekEnding: existing.weekEnding }, changes: { weekEnding: parsed } },
  });

  revalidateDelivery(existing.projectId);
}

/**
 * Two independent parent chains (week→project, task→project) must both be
 * verified — the first two-parent guessed-ID case in this codebase. Never
 * trust the caller's projectId; derive it from the week/task themselves and
 * require they agree before authorizing anything.
 */
export async function addWbsWeekEntry(wbsWeekId: string, wbsTaskId: string, _projectId: string) {
  const [week, task] = await Promise.all([
    prisma.wbsWeek.findUniqueOrThrow({ where: { id: wbsWeekId } }),
    prisma.wbsTask.findUniqueOrThrow({ where: { id: wbsTaskId } }),
  ]);
  if (week.projectId !== task.projectId) {
    throw new Error("This task and week belong to different projects.");
  }
  const user = await requireModuleWrite(week.projectId, "DELIVERY");

  let competencyMultiplier = 1;
  if (task.personId) {
    const person = await prisma.person.findUnique({ where: { id: task.personId }, include: { competency: true } });
    competencyMultiplier = person?.competency?.multiplier ?? 1;
  }

  const created = await prisma.wbsWeekEntry.create({
    data: {
      wbsWeekId,
      wbsTaskId,
      pctComplete: 0,
      actualManDays: 0,
      personId: task.personId,
      personName: task.personName,
      competencyMultiplier,
    },
  });

  await writeAudit({
    actor: user,
    projectId: week.projectId,
    action: "create",
    entityType: "WbsWeekEntry",
    entityId: created.id,
    summary: `Added "${task.title}" to a tracking week`,
  });
  revalidateDelivery(week.projectId);
}

export async function updateWbsWeekEntry(
  id: string,
  _projectId: string,
  data: Partial<{ pctComplete: number; actualManDays: number; personId: string | null }>
) {
  const existing = await prisma.wbsWeekEntry.findUniqueOrThrow({ where: { id }, include: { wbsWeek: true } });
  const user = await requireModuleWrite(existing.wbsWeek.projectId, "DELIVERY");

  let personFields: { personId?: string | null; personName?: string | null; competencyMultiplier?: number } = {};
  if (data.personId !== undefined) {
    if (data.personId === null) {
      personFields = { personId: null, personName: null, competencyMultiplier: 1 };
    } else {
      const person = await resolvePerson(existing.wbsWeek.projectId, data.personId);
      personFields = { personId: person.id, personName: person.name, competencyMultiplier: person.competency?.multiplier ?? 1 };
    }
  }

  await prisma.wbsWeekEntry.update({
    where: { id },
    data: {
      ...(data.pctComplete !== undefined ? { pctComplete: data.pctComplete } : {}),
      ...(data.actualManDays !== undefined ? { actualManDays: data.actualManDays } : {}),
      ...personFields,
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.wbsWeek.projectId,
    action: "update",
    entityType: "WbsWeekEntry",
    entityId: id,
    summary: "Updated a week's tracked progress on a WBS task",
    diff: { before: existing, changes: data },
  });

  revalidateDelivery(existing.wbsWeek.projectId);
}

export async function deleteWbsWeekEntry(id: string, _projectId: string) {
  const existing = await prisma.wbsWeekEntry.findUniqueOrThrow({ where: { id }, include: { wbsWeek: true } });
  const user = await requireModuleWrite(existing.wbsWeek.projectId, "DELIVERY");

  await prisma.wbsWeekEntry.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.wbsWeek.projectId,
    action: "delete",
    entityType: "WbsWeekEntry",
    entityId: id,
    summary: "Removed a WBS task from a tracking week",
    diff: { before: existing },
  });

  revalidateDelivery(existing.wbsWeek.projectId);
}
