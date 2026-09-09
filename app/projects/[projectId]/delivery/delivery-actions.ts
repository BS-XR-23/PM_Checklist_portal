"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { parseDateInput, normalizeTaskTitle } from "@/lib/format";
import { requireModuleWrite, requireUser, writeAudit, type CurrentUser } from "@/lib/rbac";
import {
  liveSprintContribution,
  parseSprintContributions,
  sprintTotalsFromContributions,
  type SprintTaskContribution,
} from "@/lib/calculations";

/**
 * Reopening a closed sprint — the one sprint action still restricted to the
 * global Admin role regardless of a PM's normal Delivery WRITE access. Once
 * a sprint is closed its PV/EV/AV are a permanent record; un-freezing that
 * is a deliberate reorganize decision, not day-to-day PM work. Every other
 * sprint action (rename/re-date/delete while open, close it) just uses
 * requireModuleWrite like the rest of Delivery.
 */
async function requireSprintAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can reopen a closed sprint.");
  }
  return user;
}

function revalidateDelivery(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/delivery/tasks`);
  revalidatePath(`/projects/${projectId}/delivery/sprints`);
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

export async function createWbsTask(
  projectId: string,
  data?: { wbsNumber?: string; title?: string; storyPoints?: number }
): Promise<{ id: string }> {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const title = data?.title?.trim() || "New task";
  const created = await prisma.wbsTask.create({
    data: { projectId, wbsNumber: data?.wbsNumber?.trim() ?? "", title, storyPoints: data?.storyPoints ?? 0 },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "WbsTask", entityId: created.id, summary: "Added a WBS task" });
  revalidateDelivery(projectId);
  return { id: created.id };
}

export async function updateWbsTask(
  id: string,
  _projectId: string,
  data: Partial<{ wbsNumber: string; title: string; storyPoints: number; personId: string | null }>
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
      ...(data.storyPoints !== undefined ? { storyPoints: data.storyPoints } : {}),
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

  // No DB-level Restrict backs this up (that existed via WbsWeekEntry,
  // which no longer exists) — this app-level check is now the only thing
  // protecting a sprint's PV/EV/AV from losing the task that explains it.
  // Blanket "must be uncommitted first" regardless of open/closed: deleting
  // a task still committed to an *open* sprint used to be allowed and would
  // silently erase its contribution with zero trace anywhere (worse than
  // moving it, since the task itself stops existing) — uncommitting first
  // (assignTaskToSprint) snapshots that contribution into the sprint's
  // departedTaskSnapshot before the task is gone, so the sprint keeps it.
  if (existing.sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: existing.sprintId } });
    const closedNote = sprint?.closedAt ? " (closed — ask an Admin to reopen it first)" : "";
    throw new Error(`This task is committed to sprint "${sprint?.name ?? "?"}"${closedNote} — remove it from the sprint before deleting it.`);
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

type UploadRow = { wbsNumber: string; title: string; storyPoints: number; assignee: string | null };

/** Header aliases so a PM's existing spreadsheet columns work without renaming anything first. */
const HEADER_ALIASES: Record<string, keyof UploadRow> = {
  "wbs#": "wbsNumber",
  wbs: "wbsNumber",
  "wbs number": "wbsNumber",
  "wbs no": "wbsNumber",
  "wbs no.": "wbsNumber",
  "wbs id": "wbsNumber",
  "wbs code": "wbsNumber",
  title: "title",
  task: "title",
  summary: "title",
  "story points": "storyPoints",
  "story pts": "storyPoints",
  points: "storyPoints",
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
        storyPoints: row.storyPoints ?? 0,
        assignee: row.assignee ?? null,
      };
    })
    .filter((r) => r.title !== ""); // skip fully-blank trailing rows
}

function exactRowKey(wbsNumber: string, title: string): string {
  return `${wbsNumber.trim().toLowerCase()}|${normalizeTaskTitle(title)}`;
}

export async function uploadWbsTasks(
  projectId: string,
  formData: FormData
): Promise<{
  importedCount: number;
  skippedExactDuplicateCount: number;
  missingWbsCount: number;
  duplicateCount: number;
  duplicateTaskIds: string[];
}> {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "upload";

  const buffer = await file.arrayBuffer();
  const parsedRows = parseUploadRows(buffer);
  if (parsedRows.length === 0) throw new Error("No rows found in the uploaded file — check it has WBS#/Title/Story Points columns.");

  const existingTasks = await prisma.wbsTask.findMany({ where: { projectId }, select: { wbsNumber: true, title: true } });

  // Exact match (same WBS# *and* same title) is unambiguous — it's the same
  // work item, not just a similarly-named one — so those rows are skipped
  // outright rather than imported and cleaned up later. Checked against
  // both pre-existing tasks and earlier rows in this same file.
  const existingExactKeys = new Set(existingTasks.map((t) => exactRowKey(t.wbsNumber, t.title)));
  const seenExactInBatch = new Set<string>();
  const rows = parsedRows.filter((r) => {
    const key = exactRowKey(r.wbsNumber, r.title);
    if (existingExactKeys.has(key) || seenExactInBatch.has(key)) return false;
    seenExactInBatch.add(key);
    return true;
  });
  const skippedExactDuplicateCount = parsedRows.length - rows.length;

  // Silently defaulting wbsNumber to "" (unrecognized column header — e.g. a
  // Jira export's "Key" isn't one of the WBS# aliases) used to be invisible
  // until someone noticed blank cells later. Surface it instead.
  const missingWbsCount = rows.filter((r) => !r.wbsNumber).length;

  // Same-title-only (different or blank WBS#) is fuzzier — could be a real
  // duplicate or just a coincidence — so this tier stays a warning with an
  // undo action, never a silent skip. Same "title already exists" check as
  // the manual Add Row flow.
  const existingTitles = new Set(existingTasks.map((t) => normalizeTaskTitle(t.title)));
  // Only rows duplicating a *pre-existing* task get an unambiguous "undo
  // this specific row" action below — two new rows in the same file sharing
  // a title is ambiguous about which one is "the" duplicate, so those are
  // still counted (and flagged per-row on the table afterward) but not
  // included in duplicateTaskIds.
  const seenTitleInBatch = new Set<string>();
  let duplicateCount = 0;
  const preExistingDuplicateKeys = new Set<string>();
  for (const r of rows) {
    const key = normalizeTaskTitle(r.title);
    if (existingTitles.has(key)) {
      duplicateCount++;
      preExistingDuplicateKeys.add(key);
    } else if (seenTitleInBatch.has(key)) {
      duplicateCount++;
    }
    seenTitleInBatch.add(key);
  }

  // Assignee matches by exact Person.name (case-insensitive) among people
  // actually engaged on this project. No match leaves the row unassigned
  // rather than failing the whole upload — a name typo shouldn't block
  // everyone else's rows from importing.
  const engagements = await prisma.projectEngagement.findMany({ where: { projectId }, include: { person: true } });
  const byName = new Map(engagements.map((e) => [e.person.name.trim().toLowerCase(), e.person]));

  // create() in a loop instead of createMany() — need each row's id back to
  // offer the one-click "undo the duplicates" action below.
  const created = await Promise.all(
    rows.map((r) => {
      const person = r.assignee ? byName.get(r.assignee.trim().toLowerCase()) : undefined;
      return prisma.wbsTask.create({
        data: {
          projectId,
          wbsNumber: r.wbsNumber,
          title: r.title,
          storyPoints: r.storyPoints,
          personId: person?.id ?? null,
          personName: person?.name ?? null,
        },
      });
    })
  );
  const duplicateTaskIds = created.filter((t) => preExistingDuplicateKeys.has(normalizeTaskTitle(t.title))).map((t) => t.id);

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "WbsTask",
    summary: `Uploaded ${rows.length} WBS task${rows.length === 1 ? "" : "s"} from ${fileName}`
      + (skippedExactDuplicateCount > 0 ? ` (skipped ${skippedExactDuplicateCount} exact duplicate${skippedExactDuplicateCount === 1 ? "" : "s"} — same WBS# and title)` : "")
      + (missingWbsCount > 0 ? ` (WBS# column not recognized for ${missingWbsCount} of them)` : "")
      + (duplicateCount > 0 ? ` (${duplicateCount} look like duplicates of existing titles)` : ""),
  });

  revalidateDelivery(projectId);
  return { importedCount: rows.length, skippedExactDuplicateCount, missingWbsCount, duplicateCount, duplicateTaskIds };
}

/**
 * Progress tracking (Sprints tab) — a task's %complete/actualHours/assignee
 * are tracked directly on it, one running value, not one per week. Only
 * meaningful once committed to a sprint; locked once that sprint closes,
 * same "closed = immutable" rule Sprint enforces everywhere else.
 */
export async function updateTaskProgress(
  taskId: string,
  _projectId: string,
  data: Partial<{ pctComplete: number; actualHours: number; personId: string | null }>
) {
  const existing = await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskId } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  if (!existing.sprintId) {
    throw new Error("Commit this task to a sprint before tracking progress.");
  }
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: existing.sprintId } });
  if (sprint.closedAt) {
    throw new Error("This task's sprint is closed and can no longer be edited.");
  }

  let personFields: { personId?: string | null; personName?: string | null; competencyMultiplier?: number } = {};
  if (data.personId !== undefined) {
    if (data.personId === null) {
      personFields = { personId: null, personName: null, competencyMultiplier: 1 };
    } else {
      const person = await resolvePerson(existing.projectId, data.personId);
      personFields = { personId: person.id, personName: person.name, competencyMultiplier: person.competency?.multiplier ?? 1 };
    }
  }

  await prisma.wbsTask.update({
    where: { id: taskId },
    data: {
      ...(data.pctComplete !== undefined ? { pctComplete: data.pctComplete } : {}),
      ...(data.actualHours !== undefined ? { actualHours: data.actualHours } : {}),
      ...personFields,
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "WbsTask",
    entityId: taskId,
    summary: "Updated a task's tracked progress",
    diff: { before: existing, changes: data },
  });

  revalidateDelivery(existing.projectId);
}

// --- Sprints ---

export async function createSprint(projectId: string, name: string, startDate: string, endDate: string) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  if (!name.trim()) throw new Error("A sprint name is required.");
  const parsedStart = parseDateInput(startDate);
  const parsedEnd = parseDateInput(endDate);
  if (!parsedStart || !parsedEnd) throw new Error("A valid start and end date are required.");

  const created = await prisma.sprint.create({
    data: { projectId, name: name.trim(), startDate: parsedStart, endDate: parsedEnd },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "Sprint", entityId: created.id, summary: `Added sprint "${created.name}"` });
  revalidateDelivery(projectId);
}

/**
 * Normal PM write access — same as the rest of an open sprint's content
 * (tasks, allocations). A closed sprint is locked from this too: rename/
 * re-date it after freezing PV/EV/AV and the numbers on the report no
 * longer describe the dates/name shown, so it needs an Admin to explicitly
 * reopenSprint() first rather than being editable (by anyone) in place.
 */
export async function updateSprint(
  id: string,
  _projectId: string,
  data: Partial<{ name: string; startDate: string; endDate: string }>
) {
  const existing = await prisma.sprint.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  if (existing.closedAt) {
    throw new Error("This sprint is closed — ask an Admin to reopen it before editing.");
  }

  const updateData: { name?: string; startDate?: Date; endDate?: Date } = {};
  if (data.name !== undefined) {
    if (!data.name.trim()) throw new Error("A sprint name is required.");
    updateData.name = data.name.trim();
  }
  if (data.startDate !== undefined) {
    const parsed = parseDateInput(data.startDate);
    if (!parsed) throw new Error("A valid start date is required.");
    updateData.startDate = parsed;
  }
  if (data.endDate !== undefined) {
    const parsed = parseDateInput(data.endDate);
    if (!parsed) throw new Error("A valid end date is required.");
    updateData.endDate = parsed;
  }

  await prisma.sprint.update({ where: { id }, data: updateData });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "Sprint",
    entityId: id,
    summary: "Updated a sprint",
    diff: { before: existing, changes: data },
  });

  revalidateDelivery(existing.projectId);
}

/**
 * One-way: freezes PV/EV/AV, plus a snapshot of exactly which tasks earned
 * them (frozenTaskSnapshot), as a permanent record. Without the task
 * snapshot, a closed sprint's drill-down would keep changing if a task's
 * pctComplete/actualHours are edited afterward (they live directly on the
 * mutable WbsTask row) even though the frozen totals stay correct — this
 * keeps the "which tasks earned this" list just as frozen as the numbers
 * it explains. Closing is final for everyone except an Admin, who can undo
 * it via reopenSprint() below.
 *
 * Frozen totals are computed over *every* task that ever contributed to
 * this sprint while it was open — its still-live tasks, unioned with
 * departedTaskSnapshot (anything moved elsewhere or uncommitted mid-flight,
 * see assignTaskToSprint) — not just whatever happens to still be
 * committed at the moment of closing. For a sprint with no departures
 * (the common case) this is exactly the same computation as before: the
 * union is just the live tasks, and sprintOwnHours(actualHours, 0) ==
 * actualHours for a task whose sprintEntryHours baseline was never reset.
 */
export async function closeSprint(id: string, _projectId: string) {
  const existing = await prisma.sprint.findUniqueOrThrow({
    where: { id },
    include: { tasks: { include: { person: { include: { roleRate: true } } } } },
  });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  if (existing.closedAt) throw new Error("This sprint is already closed.");

  const entries: SprintTaskContribution[] = [
    ...existing.tasks.map(liveSprintContribution),
    ...parseSprintContributions(existing.departedTaskSnapshot),
  ];
  const { plannedValue, earnedValue, actualValue } = sprintTotalsFromContributions(entries);
  const taskSnapshot = entries.map((e) => ({
    taskId: e.taskId,
    wbsNumber: e.wbsNumber,
    title: e.title,
    storyPoints: e.storyPoints,
    pctComplete: e.pctComplete,
    sprintOwnHours: e.sprintOwnHours,
    competencyMultiplier: e.competencyMultiplier,
    manDayRate: e.manDayRate,
    roleName: e.roleName,
  }));

  await prisma.sprint.update({
    where: { id },
    data: {
      closedAt: new Date(),
      frozenPlannedPoints: plannedValue,
      frozenEarnedPoints: earnedValue,
      frozenActualValue: actualValue,
      frozenTaskSnapshot: taskSnapshot,
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "Sprint",
    entityId: id,
    summary: `Closed sprint "${existing.name}" — PV ${plannedValue.toFixed(1)}, EV ${earnedValue.toFixed(1)}, AV ${actualValue.toFixed(1)}`,
  });

  revalidateDelivery(existing.projectId);
}

/**
 * Admin-only escape hatch out of the closed lock. Deliberately just flips
 * closedAt back to null and leaves the frozen* columns alone — they're
 * simply ignored (the UI reads live task data) once the sprint is open
 * again, and get overwritten with fresh numbers whenever it's next closed,
 * so there's nothing to clean up here.
 */
export async function reopenSprint(id: string, _projectId: string) {
  const existing = await prisma.sprint.findUniqueOrThrow({ where: { id } });
  const user = await requireSprintAdmin();

  if (!existing.closedAt) throw new Error("This sprint isn't closed.");

  await prisma.sprint.update({ where: { id }, data: { closedAt: null } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "Sprint",
    entityId: id,
    summary: `Reopened sprint "${existing.name}"`,
  });

  revalidateDelivery(existing.projectId);
}

/**
 * Normal PM write access, same as updateSprint above — a closed sprint
 * still can't be deleted until an Admin reopens it first. Still requires
 * the sprint to be empty: deleting one with committed tasks would silently
 * detach them (WbsTask.sprintId -> null via onDelete: SetNull) without a
 * trace, so tasks need to be uncommitted explicitly first regardless of
 * who's deleting.
 */
export async function deleteSprint(id: string, _projectId: string) {
  const existing = await prisma.sprint.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  if (existing.closedAt) {
    throw new Error("This sprint is closed — ask an Admin to reopen it before deleting.");
  }

  const taskCount = await prisma.wbsTask.count({ where: { sprintId: id } });
  if (taskCount > 0) {
    throw new Error(`This sprint has ${taskCount} committed task${taskCount === 1 ? "" : "s"} — remove them from the sprint first.`);
  }

  await prisma.sprint.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "Sprint",
    entityId: id,
    summary: `Deleted sprint "${existing.name}"`,
    diff: { before: existing },
  });

  revalidateDelivery(existing.projectId);
}

/**
 * Two independent parent chains (task→project, sprint→project) must both be
 * verified when committing into a sprint — never trust the caller's
 * projectId. sprintId: null uncommits the task instead.
 *
 * Whichever sprint currently holds this task (if any) needs the same
 * protection on the way out, whether it's being uncommitted to the backlog
 * or moved straight to a different sprint: a closed sprint can't be touched
 * at all without an Admin reopening it first (detachFromCurrentSprint
 * throws), and an *open* one must not silently lose this task's
 * contribution the instant it leaves — so its current points/pctComplete/
 * actual-hours-so-far/rate get snapshotted into that sprint's
 * departedTaskSnapshot before the task goes. Without this, an open
 * sprint's live PV/EV/AV would just recompute over whatever's left, with
 * zero record the task was ever there.
 *
 * The destination sprint (when committing in) also gets a fresh
 * sprintEntryHours baseline — actualHours is lifetime-cumulative, so
 * without this the destination would immediately inherit the task's whole
 * history of logged hours instead of starting at 0 for its own tracking.
 */
export async function assignTaskToSprint(taskId: string, sprintId: string | null, _projectId: string) {
  const task = await prisma.wbsTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { person: { include: { roleRate: true } } },
  });

  if (sprintId === task.sprintId) return; // already exactly here — nothing to do

  async function detachFromCurrentSprint() {
    if (!task.sprintId) return;
    const currentSprint = await prisma.sprint.findUniqueOrThrow({ where: { id: task.sprintId } });
    if (currentSprint.closedAt) {
      throw new Error(`This task's sprint "${currentSprint.name}" is closed — ask an Admin to reopen it before removing tasks.`);
    }
    const departure = liveSprintContribution(task);
    const survivors = parseSprintContributions(currentSprint.departedTaskSnapshot).filter((d) => d.taskId !== taskId);
    await prisma.sprint.update({
      where: { id: currentSprint.id },
      data: { departedTaskSnapshot: [...survivors, departure] },
    });
  }

  if (sprintId === null) {
    const user = await requireModuleWrite(task.projectId, "DELIVERY");
    await detachFromCurrentSprint();
    await prisma.wbsTask.update({ where: { id: taskId }, data: { sprintId: null } });
    await writeAudit({
      actor: user,
      projectId: task.projectId,
      action: "update",
      entityType: "WbsTask",
      entityId: taskId,
      summary: `Removed "${task.title}" from its sprint`,
    });
    revalidateDelivery(task.projectId);
    return;
  }

  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  if (task.projectId !== sprint.projectId) {
    throw new Error("This task and sprint belong to different projects.");
  }
  if (sprint.closedAt) {
    throw new Error("This sprint is closed — new tasks can no longer be committed to it.");
  }
  const user = await requireModuleWrite(task.projectId, "DELIVERY");

  await detachFromCurrentSprint();

  // Returning to a sprint it previously departed while this task sat
  // elsewhere — drop that stale entry, since the task's live row covers it
  // again now and keeping both would double-count its contribution.
  const destinationDepartures = parseSprintContributions(sprint.departedTaskSnapshot);
  const withoutThisTask = destinationDepartures.filter((d) => d.taskId !== taskId);
  if (withoutThisTask.length !== destinationDepartures.length) {
    await prisma.sprint.update({ where: { id: sprintId }, data: { departedTaskSnapshot: withoutThisTask } });
  }

  await prisma.wbsTask.update({ where: { id: taskId }, data: { sprintId, sprintEntryHours: task.actualHours } });

  await writeAudit({
    actor: user,
    projectId: task.projectId,
    action: "update",
    entityType: "WbsTask",
    entityId: taskId,
    summary: `Committed "${task.title}" to sprint "${sprint.name}"`,
  });
  revalidateDelivery(task.projectId);
}

// --- Sprint team allocation (reference-only capacity cross-check, never feeds PV/EV/AV) ---

export async function addSprintAllocation(sprintId: string, personId: string, _projectId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  const user = await requireModuleWrite(sprint.projectId, "DELIVERY");

  if (sprint.closedAt) throw new Error("This sprint is closed and can no longer be edited.");

  const person = await resolvePerson(sprint.projectId, personId);

  const created = await prisma.sprintAllocation.create({
    data: { sprintId, personId: person.id, allocationPct: 1 },
  });

  await writeAudit({
    actor: user,
    projectId: sprint.projectId,
    action: "create",
    entityType: "SprintAllocation",
    entityId: created.id,
    summary: `Added ${person.name} to sprint "${sprint.name}"'s team allocation`,
  });
  revalidateDelivery(sprint.projectId);
}

export async function updateSprintAllocation(
  id: string,
  _projectId: string,
  data: Partial<{ allocationPct: number; jiraHours: number | null }>
) {
  const existing = await prisma.sprintAllocation.findUniqueOrThrow({ where: { id }, include: { sprint: true } });
  const user = await requireModuleWrite(existing.sprint.projectId, "DELIVERY");

  if (existing.sprint.closedAt) throw new Error("This sprint is closed and can no longer be edited.");

  await prisma.sprintAllocation.update({
    where: { id },
    data: {
      ...(data.allocationPct !== undefined ? { allocationPct: data.allocationPct } : {}),
      ...(data.jiraHours !== undefined ? { jiraHours: data.jiraHours } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.sprint.projectId,
    action: "update",
    entityType: "SprintAllocation",
    entityId: id,
    summary: "Updated a sprint team allocation",
    diff: { before: existing, changes: data },
  });
  revalidateDelivery(existing.sprint.projectId);
}

export async function deleteSprintAllocation(id: string, _projectId: string) {
  const existing = await prisma.sprintAllocation.findUniqueOrThrow({ where: { id }, include: { sprint: true } });
  const user = await requireModuleWrite(existing.sprint.projectId, "DELIVERY");

  if (existing.sprint.closedAt) throw new Error("This sprint is closed and can no longer be edited.");

  await prisma.sprintAllocation.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.sprint.projectId,
    action: "delete",
    entityType: "SprintAllocation",
    entityId: id,
    summary: "Removed a person from a sprint's team allocation",
    diff: { before: existing },
  });
  revalidateDelivery(existing.sprint.projectId);
}
