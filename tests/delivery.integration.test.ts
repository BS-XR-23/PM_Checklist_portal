// Same real-DB / mocking setup as tests/isolation.integration.test.ts and
// tests/resourcing.integration.test.ts, focused on the Delivery module
// (WbsTask master list, committed to a Sprint for tracking — progress lives
// directly on the task, no weekly checkpoint rows): a PM assigned to
// Project A must never be able to manage Project B's WBS/Sprints, even
// with a real, valid task/sprint id from B; a Client (default DELIVERY:
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
  let adminUserId: string;
  let seniorCompetency: { id: string; multiplier: number };
  let engagedPerson: { id: string };

  beforeAll(async () => {
    projectA = await prisma.project.create({ data: { name: "[TEST] Delivery Project A", contractValue: 10000, plannedStoryPoints: 20 } });
    projectB = await prisma.project.create({ data: { name: "[TEST] Delivery Project B", contractValue: 20000, plannedStoryPoints: 40 } });

    const passwordHash = await bcrypt.hash("test-password-not-used", 10);
    const pmA = await prisma.user.create({ data: { email: `test-delivery-pm-a-${Date.now()}@example.test`, name: "Test PM A", passwordHash, role: "PM" } });
    const clientB = await prisma.user.create({
      data: { email: `test-delivery-client-b-${Date.now()}@example.test`, name: "Test Client B", passwordHash, role: "CLIENT" },
    });
    const admin = await prisma.user.create({ data: { email: `test-delivery-admin-${Date.now()}@example.test`, name: "Test Admin", passwordHash, role: "ADMIN" } });
    pmAUserId = pmA.id;
    clientBUserId = clientB.id;
    adminUserId = admin.id;

    await prisma.projectMembership.create({ data: { userId: pmAUserId, projectId: projectA.id, role: "PM" } });
    await prisma.projectMembership.create({ data: { userId: clientBUserId, projectId: projectB.id, role: "CLIENT" } });

    seniorCompetency = await prisma.competency.create({ data: { level: "[TEST] Senior", multiplier: 1.3 } });
    const person = await prisma.person.create({ data: { name: "[TEST] Delivery Person", competencyId: seniorCompetency.id } });
    engagedPerson = { id: person.id };
    await prisma.projectEngagement.create({ data: { personId: person.id, projectId: projectA.id, roleOnProject: "Engineer" } });
  });

  afterAll(async () => {
    await prisma.wbsTask.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
    await prisma.sprint.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
    await prisma.projectEngagement.deleteMany({ where: { personId: engagedPerson.id } });
    await prisma.person.delete({ where: { id: engagedPerson.id } });
    await prisma.competency.delete({ where: { id: seniorCompetency.id } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId, adminUserId] } } });
  });

  it("createWbsTask + assignTaskToSprint + updateTaskProgress: assigning an engaged person snapshots their Competency multiplier", async () => {
    const { createWbsTask, createSprint, assignTaskToSprint, updateTaskProgress } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );

    actAs(pmAUserId); // PM-A has WRITE on Project A's DELIVERY module
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id } });

    await createSprint(projectA.id, "[TEST] Sprint 1", "2026-01-01", "2026-01-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);

    await updateTaskProgress(task.id, projectA.id, { personId: engagedPerson.id });
    const updated = await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.personName).toBe("[TEST] Delivery Person");
    expect(updated.competencyMultiplier).toBe(1.3);

    // Clean up this test's own rows so later tests in this file start from a known state.
    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
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

  it("a person not engaged on the project is rejected when assigned via updateTaskProgress", async () => {
    const { createWbsTask, createSprint, assignTaskToSprint, updateTaskProgress } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );
    const unengagedPerson = await prisma.person.create({ data: { name: "[TEST] Not engaged on A (progress)" } });

    try {
      actAs(pmAUserId);
      await createWbsTask(projectA.id);
      const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
      await createSprint(projectA.id, "[TEST] Sprint 1b", "2026-01-01", "2026-01-14");
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
      await assignTaskToSprint(task.id, sprint.id, projectA.id);

      await expect(updateTaskProgress(task.id, projectA.id, { personId: unengagedPerson.id })).rejects.toThrow();
      expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).personId).toBeNull();

      await prisma.wbsTask.delete({ where: { id: task.id } });
      await prisma.sprint.delete({ where: { id: sprint.id } });
    } finally {
      await prisma.person.delete({ where: { id: unengagedPerson.id } });
    }
  });

  it("updateTaskProgress is rejected before the task is committed to a sprint, and once its sprint is closed", async () => {
    const { createWbsTask, createSprint, assignTaskToSprint, closeSprint, updateTaskProgress } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );

    actAs(pmAUserId);
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await expect(updateTaskProgress(task.id, projectA.id, { pctComplete: 0.5 })).rejects.toThrow(/commit this task/i);

    await createSprint(projectA.id, "[TEST] Sprint 1c", "2026-01-01", "2026-01-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);
    await closeSprint(sprint.id, projectA.id);

    await expect(updateTaskProgress(task.id, projectA.id, { pctComplete: 0.5 })).rejects.toThrow(/closed/);

    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("deleteWbsTask is rejected once the task is committed to a closed sprint", async () => {
    const { createWbsTask, createSprint, assignTaskToSprint, closeSprint, deleteWbsTask } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );

    actAs(pmAUserId);
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await createSprint(projectA.id, "[TEST] Sprint 1d", "2026-01-01", "2026-01-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);
    await closeSprint(sprint.id, projectA.id);

    await expect(deleteWbsTask(task.id, projectA.id)).rejects.toThrow(/closed sprint/);
    expect(await prisma.wbsTask.findUnique({ where: { id: task.id } })).not.toBeNull();

    // A task still in an OPEN sprint has fed nothing frozen — deleting it is safe.
    await createSprint(projectA.id, "[TEST] Sprint 1e", "2026-02-01", "2026-02-14");
    const openSprint = await prisma.sprint.findFirstOrThrow({ where: { name: "[TEST] Sprint 1e" } });
    await createWbsTask(projectA.id);
    const task2 = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task2.id, openSprint.id, projectA.id);
    await deleteWbsTask(task2.id, projectA.id);
    expect(await prisma.wbsTask.findUnique({ where: { id: task2.id } })).toBeNull();

    await prisma.sprint.delete({ where: { id: openSprint.id } });
    // `task` itself can never be deleted via the app action once its sprint
    // is closed (that's the point of this test) — clean it up directly.
    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("guessed-ID: PM-A cannot touch a WBS task belonging to Project B, even passing projectA.id", async () => {
    const { updateWbsTask, deleteWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const taskB = await prisma.wbsTask.create({ data: { projectId: projectB.id, wbsNumber: "1.1", title: "[TEST] B task", storyPoints: 5 } });

    try {
      actAs(pmAUserId);
      await expect(updateWbsTask(taskB.id, projectA.id, { storyPoints: 99 })).rejects.toThrow();
      await expect(deleteWbsTask(taskB.id, projectA.id)).rejects.toThrow();
      const stillUnchanged = await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskB.id } });
      expect(stillUnchanged.storyPoints).toBe(5);
    } finally {
      await prisma.wbsTask.delete({ where: { id: taskB.id } });
    }
  });

  it("guessed-ID: PM-A cannot create a WBS task on Project B, or update progress on a task belonging to Project B", async () => {
    const { createWbsTask, updateTaskProgress } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const taskB = await prisma.wbsTask.create({ data: { projectId: projectB.id, wbsNumber: "1.2", title: "[TEST] B task 2", storyPoints: 3 } });

    try {
      actAs(pmAUserId);
      await expect(createWbsTask(projectB.id)).rejects.toThrow();
      await expect(updateTaskProgress(taskB.id, projectA.id, { pctComplete: 0.9 })).rejects.toThrow();
      expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskB.id } })).pctComplete).toBe(0);
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
    const csv = ["WBS#,Title,Story Points,Assignee", "1.1,Build widget,5,[TEST] Delivery Person", "1.2,Fix bug,1,"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.set("file", blob, "wbs.csv");

    await uploadWbsTasks(projectA.id, formData);

    const tasks = await prisma.wbsTask.findMany({ where: { projectId: projectA.id }, orderBy: { wbsNumber: "asc" } });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ wbsNumber: "1.1", title: "Build widget", storyPoints: 5 });
    expect(tasks[0].personId).toBe(engagedPerson.id);
    expect(tasks[1]).toMatchObject({ wbsNumber: "1.2", title: "Fix bug", storyPoints: 1 });
    expect(tasks[1].personId).toBeNull();

    await prisma.wbsTask.deleteMany({ where: { id: { in: tasks.map((t) => t.id) } } });
  });

  it("guessed-ID: PM-A cannot upload tasks into Project B", async () => {
    const { uploadWbsTasks } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const csv = "WBS#,Title,Story Points\n1.1,Sneaky,5";
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.set("file", blob, "wbs.csv");

    actAs(pmAUserId);
    await expect(uploadWbsTasks(projectB.id, formData)).rejects.toThrow();
    expect(await prisma.wbsTask.count({ where: { projectId: projectB.id } })).toBe(0);
  });

  it("updateSprint/deleteSprint are Admin-only — a PM with normal Delivery WRITE access is rejected", async () => {
    const { createSprint, updateSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 2", "2026-02-01", "2026-02-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await expect(updateSprint(sprint.id, projectA.id, { name: "should fail" })).rejects.toThrow(/Admin/);
    await expect(deleteSprint(sprint.id, projectA.id)).rejects.toThrow(/Admin/);
    expect((await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })).name).toBe("[TEST] Sprint 2");

    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("updateSprint/deleteSprint: Admin can edit and delete a sprint, including overriding the closed lock", async () => {
    const { createSprint, updateSprint, closeSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 2b", "2026-02-01", "2026-02-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    actAs(adminUserId);
    await updateSprint(sprint.id, projectA.id, { name: "[TEST] Sprint 2b renamed" });
    expect((await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })).name).toBe("[TEST] Sprint 2b renamed");

    await closeSprint(sprint.id, projectA.id);

    // Admin escape hatch: still editable after close, unlike everyone else.
    await updateSprint(sprint.id, projectA.id, { name: "[TEST] Sprint 2b renamed again" });
    expect((await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })).name).toBe("[TEST] Sprint 2b renamed again");

    await deleteSprint(sprint.id, projectA.id);
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toBeNull();
  });

  it("deleteSprint is rejected once it has committed tasks, even for Admin", async () => {
    const { createSprint, createWbsTask, assignTaskToSprint, deleteSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 3", "2026-03-01", "2026-03-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);

    actAs(adminUserId);
    await expect(deleteSprint(sprint.id, projectA.id)).rejects.toThrow(/committed task/);

    await assignTaskToSprint(task.id, null, projectA.id);
    await deleteSprint(sprint.id, projectA.id);
    await prisma.wbsTask.delete({ where: { id: task.id } });
  });

  it("createWbsTaskInSprint: quick-add from the Sprint panel creates a task already committed to it", async () => {
    const { createSprint, createWbsTaskInSprint, closeSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 3b", "2026-03-01", "2026-03-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await createWbsTaskInSprint(sprint.id, projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { sprintId: sprint.id } });
    expect(task.projectId).toBe(projectA.id);
    expect(task.sprintId).toBe(sprint.id);

    await closeSprint(sprint.id, projectA.id);
    await expect(createWbsTaskInSprint(sprint.id, projectA.id)).rejects.toThrow(/closed/);

    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("guessed-ID: createWbsTaskInSprint rejects a sprint belonging to Project B even when called with Project A's id", async () => {
    const { createWbsTaskInSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const sprintB = await prisma.sprint.create({
      data: { projectId: projectB.id, name: "[TEST] B Sprint quick-add", startDate: new Date("2026-03-01"), endDate: new Date("2026-03-14") },
    });

    try {
      actAs(pmAUserId);
      await expect(createWbsTaskInSprint(sprintB.id, projectA.id)).rejects.toThrow();
      expect(await prisma.wbsTask.count({ where: { sprintId: sprintB.id } })).toBe(0);
    } finally {
      await prisma.sprint.delete({ where: { id: sprintB.id } });
    }
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
    await createSprint(projectA.id, "[TEST] Sprint 4", "2026-04-01", "2026-04-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await closeSprint(sprint.id, projectA.id);

    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await expect(assignTaskToSprint(task.id, sprint.id, projectA.id)).rejects.toThrow(/closed/);

    await prisma.wbsTask.delete({ where: { id: task.id } });
    await prisma.sprint.delete({ where: { id: sprint.id } });
  });

  it("assignTaskToSprint rejects removing a task from an already-closed sprint for a PM, but allows it for Admin", async () => {
    const { createSprint, createWbsTask, assignTaskToSprint, closeSprint } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 4b", "2026-04-01", "2026-04-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await createWbsTask(projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await assignTaskToSprint(task.id, sprint.id, projectA.id);
    await closeSprint(sprint.id, projectA.id);

    await expect(assignTaskToSprint(task.id, null, projectA.id)).rejects.toThrow(/closed/);
    expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).sprintId).toBe(sprint.id);

    // Admin override — this is what makes deleteSprint's emergency escape
    // hatch actually usable on a closed sprint that still has tasks.
    actAs(adminUserId);
    await assignTaskToSprint(task.id, null, projectA.id);
    expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).sprintId).toBeNull();

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

  it("closeSprint freezes PV/EV/AV via the 0/100 rule, plus a task snapshot, matching hand-computed numbers", async () => {
    const { createSprint, createWbsTask, updateWbsTask, assignTaskToSprint, updateTaskProgress, closeSprint } = await import(
      "@/app/projects/[projectId]/delivery/delivery-actions"
    );

    actAs(pmAUserId);
    await createSprint(projectA.id, "[TEST] Sprint 5", "2026-07-01", "2026-07-14");
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });

    await createWbsTask(projectA.id);
    const taskDone = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await updateWbsTask(taskDone.id, projectA.id, { storyPoints: 10 });
    await assignTaskToSprint(taskDone.id, sprint.id, projectA.id);
    // actualHours: 72 = 9 man-days x 8 — matches this test's original man-days framing.
    await updateTaskProgress(taskDone.id, projectA.id, { pctComplete: 1, actualHours: 72, personId: engagedPerson.id });

    await createWbsTask(projectA.id);
    const taskPartial = await prisma.wbsTask.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { createdAt: "desc" } });
    await updateWbsTask(taskPartial.id, projectA.id, { storyPoints: 6 });
    await assignTaskToSprint(taskPartial.id, sprint.id, projectA.id);
    // actualHours: 32 = 4 man-days x 8
    await updateTaskProgress(taskPartial.id, projectA.id, { pctComplete: 0.6, actualHours: 32, personId: engagedPerson.id });

    await closeSprint(sprint.id, projectA.id);

    const closed = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } });
    expect(closed.closedAt).not.toBeNull();
    // PV = sum of committed storyPoints = 10 + 6
    expect(closed.frozenPlannedPoints).toBe(16);
    // EV via 0/100 rule: taskDone at 100% earns its 10 points; taskPartial at 60% earns 0
    expect(closed.frozenEarnedPoints).toBe(10);
    // AV = (actualHours / 8) x competencyMultiplier (1.3, Senior), summed: 9x1.3 + 4x1.3
    expect(closed.frozenActualValue).toBeCloseTo(16.9, 5);

    const snapshot = closed.frozenTaskSnapshot as unknown as { taskId: string; storyPoints: number; pctComplete: number }[];
    expect(snapshot).toHaveLength(2);
    expect(snapshot.find((t) => t.taskId === taskDone.id)).toMatchObject({ storyPoints: 10, pctComplete: 1 });
    expect(snapshot.find((t) => t.taskId === taskPartial.id)).toMatchObject({ storyPoints: 6, pctComplete: 0.6 });

    // Editing the task after close must not affect the frozen snapshot.
    await expect(updateTaskProgress(taskPartial.id, projectA.id, { pctComplete: 1 })).rejects.toThrow(/closed/);

    await expect(closeSprint(sprint.id, projectA.id)).rejects.toThrow(/already closed/);

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
      await createSprint(projectA.id, "[TEST] Sprint 6", "2026-08-01", "2026-08-14");
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
    await createSprint(projectA.id, "[TEST] Sprint 7", "2026-09-01", "2026-09-14");
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
