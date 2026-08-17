"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, requireUser, writeAudit, type CurrentUser } from "@/lib/rbac";
import { wbsPlannedValue, wbsActualValue, sprintEarnedValue, manDaysFromHours } from "@/lib/calculations";

/**
 * Renaming/re-dating or deleting a sprint (as opposed to the routine
 * "close it at the end of the cycle" action) is an emergency/reorganize
 * tool, not day-to-day PM work — restricted to the global Admin role
 * regardless of a PM's normal Delivery WRITE access. Deliberately checked
 * ahead of, and instead of, requireModuleWrite: an Admin already has WRITE
 * on every project, so this is the only gate that matters here.
 */
async function requireSprintAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can edit or delete a sprint.");
  }
  return user;
}

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
    data: { projectId, wbsNumber: "", title: "New task" },
  });

  await writeAudit({ actor: user, projectId, action: "create", entityType: "WbsTask", entityId: created.id, summary: "Added a WBS task" });
  revalidateDelivery(projectId);
}

/**
 * Quick-add from the Sprint panel: creates a task already committed to this
 * sprint, in one step, instead of the Tasks-tab flow of create-then-
 * separately-commit. Real parent (sprint.projectId) is re-derived from the
 * DB, never trusted from the caller — same guessed-ID protection as every
 * other two-parent action in this file.
 */
export async function createWbsTaskInSprint(sprintId: string, _projectId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  const user = await requireModuleWrite(sprint.projectId, "DELIVERY");

  if (sprint.closedAt) throw new Error("This sprint is closed — new tasks can no longer be committed to it.");

  const created = await prisma.wbsTask.create({
    data: { projectId: sprint.projectId, sprintId: sprint.id, wbsNumber: "", title: "New task" },
  });

  await writeAudit({
    actor: user,
    projectId: sprint.projectId,
    action: "create",
    entityType: "WbsTask",
    entityId: created.id,
    summary: `Added a WBS task directly to sprint "${sprint.name}"`,
  });
  revalidateDelivery(sprint.projectId);
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
  // protecting a closed sprint's frozen PV/EV/AV from losing the task that
  // explains it. A task still sitting in an open sprint hasn't fed any
  // frozen number yet, so deleting it is safe (and fully audited below).
  if (existing.sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: existing.sprintId } });
    if (sprint?.closedAt) {
      throw new Error(`This task is committed to the closed sprint "${sprint.name}" — it can't be deleted.`);
    }
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
  title: "title",
  task: "title",
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

export async function uploadWbsTasks(projectId: string, formData: FormData) {
  const user = await requireModuleWrite(projectId, "DELIVERY");

  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "upload";

  const buffer = await file.arrayBuffer();
  const rows = parseUploadRows(buffer);
  if (rows.length === 0) throw new Error("No rows found in the uploaded file — check it has WBS#/Title/Story Points columns.");

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
        storyPoints: r.storyPoints,
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
 * Admin-only — including on a closed sprint. Everyone else still can't
 * touch a closed sprint at all (no other write path exists); this is
 * specifically the Admin emergency/reorganize escape hatch. A rename or
 * date fix here doesn't touch the frozen frozenPlannedPoints/frozenEarned-
 * Points/frozenActualValue/frozenTaskSnapshot numbers themselves.
 */
export async function updateSprint(
  id: string,
  _projectId: string,
  data: Partial<{ name: string; startDate: string; endDate: string }>
) {
  const existing = await prisma.sprint.findUniqueOrThrow({ where: { id } });
  const user = await requireSprintAdmin();

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
 * it explains. No "reopen" action exists — closing is deliberately final.
 */
export async function closeSprint(id: string, _projectId: string) {
  const existing = await prisma.sprint.findUniqueOrThrow({
    where: { id },
    include: { tasks: true },
  });
  const user = await requireModuleWrite(existing.projectId, "DELIVERY");

  if (existing.closedAt) throw new Error("This sprint is already closed.");

  const plannedValue = wbsPlannedValue(existing.tasks.map((t) => ({ points: t.storyPoints })));
  const earnedValue = sprintEarnedValue(existing.tasks.map((t) => ({ points: t.storyPoints, pctComplete: t.pctComplete })));
  const actualValue = wbsActualValue(
    existing.tasks.map((t) => ({ actualManDays: manDaysFromHours(t.actualHours), competencyMultiplier: t.competencyMultiplier }))
  );
  const taskSnapshot = existing.tasks.map((t) => ({
    taskId: t.id,
    wbsNumber: t.wbsNumber,
    title: t.title,
    storyPoints: t.storyPoints,
    pctComplete: t.pctComplete,
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
 * Admin-only — including on a closed sprint (see requireSprintAdmin). Still
 * requires the sprint to be empty first: deleting one with committed tasks
 * would silently detach them (WbsTask.sprintId -> null via onDelete:
 * SetNull) without a trace, so an Admin uncommits them explicitly first —
 * same data-integrity rail as before, just now Admin-gated too.
 */
export async function deleteSprint(id: string, _projectId: string) {
  const existing = await prisma.sprint.findUniqueOrThrow({ where: { id } });
  const user = await requireSprintAdmin();

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
 * projectId. sprintId: null uncommits the task instead: no second id is
 * supplied, but the task's *current* sprint (if any) still needs a
 * closed-sprint check — a task can't silently be pulled out of a closed
 * sprint's frozen membership either, matching the same "closed =
 * immutable" rule enforced when committing in. Exception: an Admin can
 * still pull a task out of a closed sprint — this is what makes deleteSprint's
 * Admin emergency override actually usable on a closed sprint that has
 * committed tasks. Doesn't touch the sprint's frozen PV/EV/AV/snapshot,
 * which stay a permanent historical record regardless.
 */
export async function assignTaskToSprint(taskId: string, sprintId: string | null, _projectId: string) {
  const task = await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskId } });

  if (sprintId === null) {
    const user = await requireModuleWrite(task.projectId, "DELIVERY");
    if (task.sprintId) {
      const currentSprint = await prisma.sprint.findUnique({ where: { id: task.sprintId } });
      if (currentSprint?.closedAt && user.role !== "ADMIN") {
        throw new Error(`This task's sprint "${currentSprint.name}" is closed — it can no longer be removed.`);
      }
    }
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

  await prisma.wbsTask.update({ where: { id: taskId }, data: { sprintId } });

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
