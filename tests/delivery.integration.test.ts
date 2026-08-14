// Same real-DB / mocking setup as tests/isolation.integration.test.ts and
// tests/resourcing.integration.test.ts, focused on the Delivery module
// (WbsWeek/WbsTask): a PM assigned to Project A must never be able to
// manage Project B's WBS, even with a real, valid task/week id from B; a
// Client (default DELIVERY: NONE) gets no access at all; person-assignment
// re-validates engagement and snapshots Competency the same way Budget
// Tracker's role-cost rows snapshot RoleRate.
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
    await prisma.wbsWeek.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } }); // cascades tasks
    await prisma.projectEngagement.deleteMany({ where: { personId: engagedPerson.id } });
    await prisma.person.delete({ where: { id: engagedPerson.id } });
    await prisma.competency.delete({ where: { id: seniorCompetency.id } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId] } } });
  });

  it("createWbsWeek + addWbsTask + updateWbsTask: assigning an engaged person snapshots their Competency multiplier", async () => {
    const { createWbsWeek, addWbsTask, updateWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId); // PM-A has WRITE on Project A's DELIVERY module
    await createWbsWeek(projectA.id);
    const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id } });

    await addWbsTask(week.id, projectA.id);
    const task = await prisma.wbsTask.findFirstOrThrow({ where: { wbsWeekId: week.id } });

    await updateWbsTask(task.id, projectA.id, { manDays: 10, pctComplete: 0.5, actualManDays: 4, personId: engagedPerson.id });
    const updated = await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.manDays).toBe(10);
    expect(updated.pctComplete).toBe(0.5);
    expect(updated.actualManDays).toBe(4);
    expect(updated.personName).toBe("[TEST] Delivery Person");
    expect(updated.competencyMultiplier).toBe(1.3);
  });

  it("a person not engaged on the project is rejected when assigned to a task", async () => {
    const { createWbsWeek, addWbsTask, updateWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const unengagedPerson = await prisma.person.create({ data: { name: "[TEST] Not engaged on A" } });

    try {
      actAs(pmAUserId);
      await createWbsWeek(projectA.id);
      const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });
      await addWbsTask(week.id, projectA.id);
      const task = await prisma.wbsTask.findFirstOrThrow({ where: { wbsWeekId: week.id } });

      await expect(updateWbsTask(task.id, projectA.id, { personId: unengagedPerson.id })).rejects.toThrow();
      expect((await prisma.wbsTask.findUniqueOrThrow({ where: { id: task.id } })).personId).toBeNull();
    } finally {
      await prisma.person.delete({ where: { id: unengagedPerson.id } });
    }
  });

  it("guessed-ID: PM-A cannot touch a WBS task or week belonging to Project B, even passing projectA.id", async () => {
    const { updateWbsTask, deleteWbsTask } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const weekB = await prisma.wbsWeek.create({ data: { projectId: projectB.id, weekEnding: new Date("2026-09-01") } });
    const taskB = await prisma.wbsTask.create({ data: { wbsWeekId: weekB.id, wbsNumber: "1.1", title: "[TEST] B task", manDays: 5 } });

    try {
      actAs(pmAUserId);
      await expect(updateWbsTask(taskB.id, projectA.id, { manDays: 99 })).rejects.toThrow();
      await expect(deleteWbsTask(taskB.id, projectA.id)).rejects.toThrow();
      const stillUnchanged = await prisma.wbsTask.findUniqueOrThrow({ where: { id: taskB.id } });
      expect(stillUnchanged.manDays).toBe(5);
    } finally {
      await prisma.wbsWeek.delete({ where: { id: weekB.id } }); // cascades taskB
    }
  });

  it("guessed-ID: PM-A cannot create a WBS week on Project B", async () => {
    const { createWbsWeek } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    actAs(pmAUserId);
    await expect(createWbsWeek(projectB.id)).rejects.toThrow();
  });

  it("Client-B has no Delivery access at all — default DELIVERY permission is NONE", async () => {
    const { createWbsWeek } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    actAs(clientBUserId);
    await expect(createWbsWeek(projectB.id)).rejects.toThrow();
  });

  it("uploadWbsTasks: parses a CSV, bulk-creates rows, and matches an assignee by name among engaged people", async () => {
    const { createWbsWeek, uploadWbsTasks } = await import("@/app/projects/[projectId]/delivery/delivery-actions");

    actAs(pmAUserId);
    await createWbsWeek(projectA.id);
    const week = await prisma.wbsWeek.findFirstOrThrow({ where: { projectId: projectA.id }, orderBy: { weekEnding: "desc" } });

    const csv = ["WBS#,Title,Man-days,%,Actual Man-days,Assignee", "1.1,Build widget,5,70%,4,[TEST] Delivery Person", "1.2,Fix bug,1,100%,1,"].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.set("file", blob, "wbs.csv");

    await uploadWbsTasks(week.id, projectA.id, formData);

    const tasks = await prisma.wbsTask.findMany({ where: { wbsWeekId: week.id }, orderBy: { wbsNumber: "asc" } });
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ wbsNumber: "1.1", title: "Build widget", manDays: 5, pctComplete: 0.7, actualManDays: 4 });
    expect(tasks[0].personId).toBe(engagedPerson.id);
    expect(tasks[0].competencyMultiplier).toBe(1.3);
    expect(tasks[1]).toMatchObject({ wbsNumber: "1.2", title: "Fix bug", manDays: 1, pctComplete: 1 });
    expect(tasks[1].personId).toBeNull();
  });

  it("guessed-ID: PM-A cannot upload tasks into Project B's week", async () => {
    const { uploadWbsTasks } = await import("@/app/projects/[projectId]/delivery/delivery-actions");
    const weekB = await prisma.wbsWeek.create({ data: { projectId: projectB.id, weekEnding: new Date("2026-09-08") } });

    try {
      const csv = "WBS#,Title,Man-days,%\n1.1,Sneaky,5,0%";
      const blob = new Blob([csv], { type: "text/csv" });
      const formData = new FormData();
      formData.set("file", blob, "wbs.csv");

      actAs(pmAUserId);
      await expect(uploadWbsTasks(weekB.id, projectA.id, formData)).rejects.toThrow();
      expect(await prisma.wbsTask.count({ where: { wbsWeekId: weekB.id } })).toBe(0);
    } finally {
      await prisma.wbsWeek.delete({ where: { id: weekB.id } });
    }
  });
});
