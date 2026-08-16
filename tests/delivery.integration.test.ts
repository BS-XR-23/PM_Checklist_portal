// Same real-DB / mocking setup as tests/isolation.integration.test.ts and
// tests/resourcing.integration.test.ts, focused on the Delivery module
// (WbsTask master list + WbsWeek/WbsWeekEntry weekly tracking): a PM
// assigned to Project A must never be able to manage Project B's WBS, even
// with a real, valid task/week/entry id from B; a Client (default DELIVERY:
// NONE) gets no access at all; person-assignment re-validates engagement and
// snapshots Competency the same way Budget Tracker's role-cost rows used to
// snapshot RoleRate.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let currentSessionUserId: string | null = null;
vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
}));

function actAs(userId: string | null) {
  currentSessionUserId = userId;
}

describe("Delivery isolation boundary", () => {
  let projectA: { id: string };
  let projectB: { id: string };
  let pmAUserId: string;
  let clientBUserId: string;
  let seniorCompetency: { id: string; multiplier: number };
  let engagedPerson: { id: string };

  beforeAll(async () => {
    projectA = await prisma.project.create({ data: { name: "[TEST] Delivery Project A", contractValue: 10000, plannedManDays: 20 } });
    projectB = await prisma.project.create({ data: { name: "[TEST] Delivery Project B", contractValue: 20000, plannedManDays: 40 } });

    const passwordHash = await bcrypt.hash("test-password-not-used", 10);
    const pmA = await prisma.user.create({ data: { email: `test-delivery-pm-a-${Date.now()}@example.test`, name: "Test PM A", passwordHash, role: "PM" } });
    const clientB = await prisma.user.create({
      data: { email: `test-delivery-client-b-${Date.now()}@example.test`, name: "Test Client B", passwordHash, role: "CLIENT" },
    });
    pmAUserId = pmA.id;
    clientBUserId = clientB.id;

    await prisma.projectMembership.create({ data: { userId: pmAUserId, projectId: projectA.id, role: "PM" } });
    await prisma.projectMembership.create({ data: { userId: clientBUserId, projectId: projectB.id, role: "CLIENT" } });

    seniorCompetency = await prisma.competency.create({ data: { level: "[TEST] Senior", multiplier: 1.3 } });
    const person = await prisma.person.create({ data: { name: "[TEST] Delivery Person", competencyId: seniorCompetency.id } });
    engagedPerson = { id: person.id };
    await prisma.projectEngagement.create({ data: { personId: person.id, projectId: projectA.id, roleOnProject: "Engineer" } });
  });

  afterAll(async () => {
    await prisma.wbsWeek.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
    await prisma.wbsTask.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } }); // cascades nothing left, but Restrict requires entries gone first
    await prisma.projectEngagement.deleteMany({ where: { personId: engagedPerson.id } });
    await prisma.person.delete({ where: { id: engagedPerson.id } });
    await prisma.competency.delete({ where: { id: seniorCompetency.id } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId] } } });
  });

  it("createWbsTask + createWbsWeek + addWbsWeekEntry: assigning an engaged person snapshots their Competency multiplier", async () => {
    const { createWbsTask, createWbsWeek, addWbsWeekEntry, updateWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId); // PM-A has WRITE on Project A's DELIVERY module
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id } });
    await updateWbsTask(task.id, projectA.id, { personId: engagedPerson.id, manDays: 10 });

    await createWbsWeek(projectA.id, null);
    const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id } });

    await addWbsWeekEntry(week.id, task.id, projectA.id);
    const entry = await prisma.wbsWeekEntry.findFirstOrThrow({ where: { wbsWeekId: week.id } });
    expect(entry.personName).toBe("[TEST] Delivery Person");
    expect(entry.competencyMultiplier).toBe(1.3);

    // Clean up this test's own rows so later tests in this file start from a known state.
    await prisma.wbsWeekEntry.delete({ where: { id: entry.id } });
    await prisma.wbsWeek.delete({ where: { id: week.id } });
    await prisma.wbsTask.delete({ where: { id: task.id } });
  });

  it("a person not engaged on the project is rejected when assigned to a master WBS task", async () => {
    const { createWbsTask, updateWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const unengagedPerson = await prisma.person.create({ data: { name: "[TEST] Not engaged on A" } });

    try {
      actAs(pmAUserId);
      await createWbsTask(projectA.id);
      const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

      await expect(updateWbsTask(task.id, projectA.id, { personId: unengagedPerson.id })).rejects.toThrow();
      expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).personId).toBeNull();

      await prisma.wbsTask.delete({ where: { id: task.id } });
    } finally {
      await prisma.person.delete({ where: { id: unengagedPerson.id } });
    }
  });

  it("deleteWbsTask is rejected once the task has logged progress in a week", async () => {
    const { createWbsTask, createWbsWeek, addWbsWeekEntry, deleteWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await createWbsWeek(projectA.id, null);
    const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });
    await addWbsWeekEntry(week.id, task.id, projectA.id);

    await expect(deleteWbsTask(task.id, projectA.id)).rejects.toThrow(/logged progress/);
    expect(await prisma.wbsTask.findUnique({ where: { id: task.id } })).not.toBeNull();

    await prisma.wbsWeekEntry.deleteMany({ where: { wbsTaskId: task.id } });
    await prisma.wbsWeek.delete({ where: { id: week.id } });
    await prisma.wbsTask.delete({ where: { id: task.id } });
  });

  it("guessed-ID: PM-A cannot touch a WBS task belonging to Project B, even passing projectA.id", async () => {
    const { updateWbsTask, deleteWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const taskB = await prisma.wbsTask.create({ data: { projectId: projectB.id, wbsNumber: "1.1", title: "[TEST] B task", manDays: 5 } });

    try {
      actAs(pmAUserId);
      await expect(updateWbsTask(taskB.id, projectA.id, { manDays: 99 })).rejects.toThrow();
      await expect(deleteWbsTask(taskB.id, projectA.id)).rejects.toThrow();
      const stillUnchanged = await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskB.id } });
      expect(stillUnchanged.manDays).toBe(5);
    } finally {
      await prisma.wbsTask.delete({ where: { id: taskB.id } });
    }
  });

  it("updateWbsWeek corrects a mistyped date, and rejects colliding with another week's date", async () => {
    const { createWbsWeek, updateWbsWeek } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const { parseDateInput } = await import("@/lib/format");

    actAs(pmAUserId);
    await createWbsWeek(projectA.id, "2026-10-01");
    const weekOct1 = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });
    await createWbsWeek(projectA.id, "2026-10-08");
    const weekOct8 = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });

    try {
      await updateWbsWeek(weekOct1.id, projectA.id, "2026-10-02");
      expect((await prisma.wbsWeek.findUniqueOrThrow({ where: { id: weekOct1.id } })).weekEnding).toEqual(parseDateInput("2026-10-02"));

      await expect(updateWbsWeek(weekOct1.id, projectA.id, "2026-10-08")).rejects.toThrow(/already has a tracking week/);
    } finally {
      await prisma.wbsWeek.delete({ where: { id: weekOct1.id } });
      await prisma.wbsWeek.delete({ where: { id: weekOct8.id } });
    }
  });

  it("guessed-ID: PM-A cannot update a WBS week belonging to Project B", async () => {
    const { updateWbsWeek } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const weekB = await prisma.wbsWeek.create({ data: { projectId: projectB.id, weekEnding: new Date("2026-10-15") } });

    try {
      actAs(pmAUserId);
      await expect(updateWbsWeek(weekB.id, projectA.id, "2026-11-01")).rejects.toThrow();
      expect((await prisma.wbsWeek.findUniqueOrThrow({ where: { id: weekB.id } })).weekEnding).toEqual(new Date("2026-10-15"));
    } finally {
      await prisma.wbsWeek.delete({ where: { id: weekB.id } });
    }
  });

  it("guessed-ID: PM-A cannot create a WBS task or week on Project B", async () => {
    const { createWbsTask, createWbsWeek } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    actAs(pmAUserId);
    await expect(createWbsTask(projectB.id)).rejects.toThrow();
    await expect(createWbsWeek(projectB.id, null)).rejects.toThrow();
  });

  it("two-parent guessed-ID: addWbsWeekEntry rejects a week from Project A paired with a task from Project B", async () => {
    const { createWbsWeek, addWbsWeekEntry } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const taskB = await prisma.wbsTask.create({ data: { projectId: projectB.id, wbsNumber: "2.1", title: "[TEST] B task 2", manDays: 3 } });

    try {
      actAs(pmAUserId);
      await createWbsWeek(projectA.id, null);
      const weekA = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });

      // weekA is genuinely Project A's (PM-A is authorized to write there),
      // taskB is genuinely Project B's — the two parent chains disagree, so
      // this must be rejected even though each id individually is real.
      await expect(addWbsWeekEntry(weekA.id, taskB.id, projectA.id)).rejects.toThrow();
      expect(await prisma.wbsWeekEntry.count({ where: { wbsWeekId: weekA.id } })).toBe(0);

      await prisma.wbsWeek.delete({ where: { id: weekA.id } });
    } finally {
      await prisma.wbsTask.delete({ where: { id: taskB.id } });
    }
  });

  it("Client-B has no Delivery access at all — default DELIVERY permission is NONE", async () => {
    const { createWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    actAs(clientBUserId);
    await expect(createWbsTask(projectB.id)).rejects.toThrow();
  });

  it("uploadWbsTasks: parses a CSV, bulk-creates master WBS rows, and matches an assignee by name among engaged people", async () => {
    const { uploadWbsTasks } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    const csv = ["WBS#,Title,Man-days,Assignee", "1.1,Build widget,5,[TEST] Delivery Person", "1.2,Fix bug,1,"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.set("file", blob, "wbs.csv");

    await uploadWbsTasks(projectA.id, formData);

    const tasks = await prisma.wbsTask.findMany({ where: { projectId: projectA.id }, orderBy: { wbsNumber: "asc" } });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ wbsNumber: "1.1", title: "Build widget", manDays: 5 });
    expect(tasks[0].personId).toBe(engagedPerson.id);
    expect(tasks[1]).toMatchObject({ wbsNumber: "1.2", title: "Fix bug", manDays: 1 });
    expect(tasks[1].personId).toBeNull();

    await prisma.wbsTask.deleteMany({ where: { id: { in: tasks.map((t) => t.id) } } });
  });

  it("guessed-ID: PM-A cannot upload tasks into Project B", async () => {
    const { uploadWbsTasks } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const csv = "WBS#,Title,Man-days\n1.1,Sneaky,5";
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.set("file", blob, "wbs.csv");

    actAs(pmAUserId);
    await expect(uploadWbsTasks(projectB.id, formData)).rejects.toThrow();
    expect(await prisma.wbsTask.count({ where: { projectId: projectB.id } })).toBe(0);
  });

  it("createSprint + updateSprint: CRUD works, and editing a closed sprint is rejected", async () => {
    const { createSprint, updateSprint, closeSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 1", "2026-01-01", "2026-01-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await updateSprint(sprint.id, projectA.id, { name: "[TEST] Sprint 1 renamed" });
    expect((await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })).name).toBe("[TEST] Sprint 1 renamed");

    await closeSprint(sprint.id, projectA.id);
    await expect(updateSprint(sprint.id, projectA.id, { name: "should fail" })).rejects.toThrow(/closed/);

    await deleteSprint(sprint.id, projectA.id);
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toBeNull();
  });

  it("deleteSprint is rejected once it has committed tasks", async () => {
    const { createSprint, createWbsTask, assignTaskToSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 2", "2026-02-01", "2026-02-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);

    await expect(deleteSprint(sprint.id, projectA.id)).rejects.toThrow(/committed task/);

    await assignTaskToSprint(task.id, null, projectA.id);
    await deleteSprint(sprint.id, projectA.id);
    await prisma.wbsTask.delete({ where: { id: task.id } });
  });

  it("two-parent guessed-ID: assignTaskToSprint rejects a task from Project A paired with a sprint from Project B", async () => {
    const { createWbsTask, assignTaskToSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const sprintB = await prisma.sprint.create({
      data: { projectId: projectB.id, name: "[TEST] B Sprint", startDate: new Date("2026-03-01"), endDate: new Date("2026-03-14") },
    });

    try {
      actAs(pmAUserId);
      await createWbsTask(projectA.id);
      const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

      await expect(assignTaskToSprint(task.id, sprintB.id, projectA.id)).rejects.toThrow();
      expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).sprintId).toBeNull();

      await prisma.wbsTask.delete({ where: { id: task.id } });
    } finally {
      await prisma.sprint.delete({ where: { id: sprintB.id } });
    }
  });

  it("assignTaskToSprint rejects committing a task into an already-closed sprint", async () => {
    const { createSprint, closeSprint, createWbsTask, assignTaskToSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 3", "2026-04-01", "2026-04-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await closeSprint(sprint.id, projectA.id);

    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await expect(assignTaskToSprint(task.id, sprint.id, projectA.id)).rejects.toThrow(/closed/);

    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("guessed-ID: PM-A cannot create a Sprint on Project B, or touch a Sprint belonging to Project B", async () => {
    const { createSprint, updateSprint, closeSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    actAs(pmAUserId);
    await expect(createSprint(projectB.id, "[TEST] Sneaky Sprint", "2026-05-01", "2026-05-14")).rejects.toThrow();

    const sprintB = await prisma.sprint.create({
      data: { projectId: projectB.id, name: "[TEST] B Sprint 2", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-14") },
    });
    try {
      await expect(updateSprint(sprintB.id, projectA.id, { name: "hacked" })).rejects.toThrow();
      await expect(closeSprint(sprintB.id, projectA.id)).rejects.toThrow();
      await expect(deleteSprint(sprintB.id, projectA.id)).rejects.toThrow();
      const stillThere = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintB.id } });
      expect(stillThere.name).toBe("[TEST] B Sprint 2");
      expect(stillThere.closedAt).toBeNull();
    } finally {
      await prisma.sprint.delete({ where: { id: sprintB.id } });
    }
  });

  it("closeSprint freezes PV/EV/AV via the 0/100 rule, matching hand-computed numbers", async () => {
    const {
      createSprint,
      createWbsTask,
      updateWbsTask,
      assignTaskToSprint,
      createWbsWeek,
      addWbsWeekEntry,
      updateWbsWeekEntry,
      closeSprint,
    } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 4", "2026-07-01", "2026-07-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await createWbsTask(projectA.id);
    const taskDone = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await updateWbsTask(taskDone.id, projectA.id, { manDays: 10, personId: engagedPerson.id });
    await assignTaskToSprint(taskDone.id, sprint.id, projectA.id);

    await createWbsTask(projectA.id);
    const taskPartial = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await updateWbsTask(taskPartial.id, projectA.id, { manDays: 6, personId: engagedPerson.id });
    await assignTaskToSprint(taskPartial.id, sprint.id, projectA.id);

    await createWbsWeek(projectA.id, "2026-07-07");
    const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });

    await addWbsWeekEntry(week.id, taskDone.id, projectA.id);
    const entryDone = await prisma.wbsWeekEntry.findFirstOrThrow({ where: { wbsWeekId: week.id, wbsTaskId: taskDone.id } });
    await updateWbsWeekEntry(entryDone.id, projectA.id, { pctComplete: 1, actualManDays: 9 });

    await addWbsWeekEntry(week.id, taskPartial.id, projectA.id);
    const entryPartial = await prisma.wbsWeekEntry.findFirstOrThrow({ where: { wbsWeekId: week.id, wbsTaskId: taskPartial.id } });
    await updateWbsWeekEntry(entryPartial.id, projectA.id, { pctComplete: 0.6, actualManDays: 4 });

    await closeSprint(sprint.id, projectA.id);

    const closed = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } });
    expect(closed.closedAt).not.toBeNull();
    // PV = sum of committed manDays = 10 + 6
    expect(closed.frozenPlannedManDays).toBe(16);
    // EV via 0/100 rule: taskDone at 100% earns its 10 manDays; taskPartial at 60% earns 0
    expect(closed.frozenEarnedManDays).toBe(10);
    // AV = actualManDays x competencyMultiplier (1.3, Senior), summed: 9*1.3 + 4*1.3
    expect(closed.frozenActualValue).toBeCloseTo(16.9, 5);

    await expect(closeSprint(sprint.id, projectA.id)).rejects.toThrow(/already closed/);

    await prisma.wbsWeekEntry.deleteMany({ where: { wbsWeekId: week.id } });
    await prisma.wbsWeek.delete({ where: { id: week.id } });
    await prisma.wbsTask.deleteMany({ where: { id: { in: [taskDone.id, taskPartial.id] } } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("addSprintAllocation + updateSprintAllocation + deleteSprintAllocation: CRUD works, and an unengaged person is rejected", async () => {
    const { createSprint, addSprintAllocation, updateSprintAllocation, deleteSprintAllocation } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );
    const unengagedPerson = await prisma.person.create({ data: { name: "[TEST] Not engaged on A (allocation)" } });

    try {
      actAs(pmAUserId);
      await createSprint(projectA.id, "[TEST] Sprint 5", "2026-08-01", "2026-08-14");
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

      await expect(addSprintAllocation(sprint.id, unengagedPerson.id, projectA.id)).rejects.toThrow();
      expect(await prisma.sprintAllocation.count({ where: { sprintId: sprint.id } })).toBe(0);

      await addSprintAllocation(sprint.id, engagedPerson.id, projectA.id);
      const allocation = await prisma.sprintAllocation.findFirstOrThrow({ where: { sprintId: sprint.id } });
      expect(allocation.allocationPct).toBe(1);
      expect(allocation.jiraHours).toBeNull();

      await updateSprintAllocation(allocation.id, projectA.id, { allocationPct: 0.5, jiraHours: 32 });
      const updated = await prisma.sprintAllocation.findUniqueOrThrow({ where: { id: allocation.id } });
      expect(updated.allocationPct).toBe(0.5);
      expect(updated.jiraHours).toBe(32);

      await deleteSprintAllocation(allocation.id, projectA.id);
      expect(await prisma.sprintAllocation.findUnique({ where: { id: allocation.id } })).toBeNull();

      await prisma.sprint.delete({ where: { id: sprint.id } });
    } finally {
      await prisma.person.delete({ where: { id: unengagedPerson.id } });
    }
  });

  it("SprintAllocation mutations are rejected once the sprint is closed", async () => {
    const { createSprint, closeSprint, addSprintAllocation } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 6", "2026-09-01", "2026-09-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await closeSprint(sprint.id, projectA.id);

    await expect(addSprintAllocation(sprint.id, engagedPerson.id, projectA.id)).rejects.toThrow(/closed/);
    expect(await prisma.sprintAllocation.count({ where: { sprintId: sprint.id } })).toBe(0);

    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("guessed-ID: PM-A cannot touch a SprintAllocation belonging to Project B", async () => {
    const { updateSprintAllocation, deleteSprintAllocation } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const sprintB = await prisma.sprint.create({
      data: { projectId: projectB.id, name: "[TEST] B Sprint 3", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-14") },
    });
    const personB = await prisma.person.create({ data: { name: "[TEST] B Person for allocation" } });
    await prisma.projectEngagement.create({ data: { personId: personB.id, projectId: projectB.id, roleOnProject: "Engineer" } });
    const allocationB = await prisma.sprintAllocation.create({ data: { sprintId: sprintB.id, personId: personB.id, allocationPct: 1 } });

    try {
      actAs(pmAUserId);
      await expect(updateSprintAllocation(allocationB.id, projectA.id, { allocationPct: 0.1 })).rejects.toThrow();
      await expect(deleteSprintAllocation(allocationB.id, projectA.id)).rejects.toThrow();
      const stillThere = await prisma.sprintAllocation.findUniqueOrThrow({ where: { id: allocationB.id } });
      expect(stillThere.allocationPct).toBe(1);
    } finally {
      await prisma.sprintAllocation.delete({ where: { id: allocationB.id } });
      await prisma.projectEngagement.deleteMany({ where: { personId: personB.id } });
      await prisma.person.delete({ where: { id: personB.id } });
      await prisma.sprint.delete({ where: { id: sprintB.id } });
    }
  });
});
