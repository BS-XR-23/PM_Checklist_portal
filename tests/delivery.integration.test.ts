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
});
