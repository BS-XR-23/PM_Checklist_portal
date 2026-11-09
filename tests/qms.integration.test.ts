// Writes to the database configured in the environment, so run it only against
// staging (docs/QMS_PLAN.md), never the shared production database. Exercises the
// recurring-log actions and the CR evidence fields through the real authorization
// code, and checks the QMS report built from what they saved.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CLIENT_PERMISSIONS } from "@/lib/rbac-core";
import { loadQmsReport } from "@/lib/qms-data";
import { logChecklistOccurrence, deleteChecklistOccurrence, updateChecklistItem } from "@/app/projects/[projectId]/checklist-actions";
import { updateChangeRequest } from "@/app/projects/[projectId]/change-requests/cr-actions";

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

let sessionUserId: string | null = null;
vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(sessionUserId ? { user: { id: sessionUserId } } : null),
}));
const actAs = (id: string | null) => {
  sessionUserId = id;
};

const LINK = "https://evidence.test/doc";

describe("QMS evidence", () => {
  let projectA: string;
  let projectB: string;
  let pmA: string;
  let clientA: string;
  let recurring: string;
  let oneTime: string;
  let inB: string;
  let sprint: string;
  let crId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    projectA = (await prisma.project.create({ data: { name: "[TEST] QMS Project A" } })).id;
    projectB = (await prisma.project.create({ data: { name: "[TEST] QMS Project B" } })).id;
    const passwordHash = await bcrypt.hash("test-password-not-used", 4);
    pmA = (await prisma.user.create({ data: { email: `test-qms-pm-${suffix}@example.test`, name: "QMS PM", passwordHash, role: "PM" } })).id;
    clientA = (await prisma.user.create({ data: { email: `test-qms-client-${suffix}@example.test`, name: "QMS Client", passwordHash, role: "CLIENT" } })).id;
    await prisma.projectMembership.create({ data: { userId: pmA, projectId: projectA, role: "PM" } });
    const clientMembership = await prisma.projectMembership.create({ data: { userId: clientA, projectId: projectA, role: "CLIENT" } });
    await prisma.modulePermission.createMany({ data: DEFAULT_CLIENT_PERMISSIONS.map((p) => ({ membershipId: clientMembership.id, module: p.module, access: p.access })) });

    const item = (projectId: string, order: number, itemText: string, isRecurring: boolean, qmsRefs: string[]) =>
      prisma.checklistItem.create({ data: { projectId, type: "PM", order, stage: "Development", itemText, isRecurring, qmsRefs } });
    recurring = (await item(projectA, 1, "[TEST] retro", true, ["Q28"])).id;
    oneTime = (await item(projectA, 2, "[TEST] one-time", false, ["Q1"])).id;
    inB = (await item(projectB, 1, "[TEST] retro in B", true, ["Q28"])).id;
    sprint = (await prisma.sprint.create({ data: { projectId: projectA, name: "[TEST] Sprint 1", startDate: new Date("2026-10-01T00:00:00"), endDate: new Date("2026-10-14T00:00:00") } })).id;
    crId = (await prisma.changeRequest.create({ data: { projectId: projectA, crCode: "CR-001", title: "[TEST] CR", status: "Approved", clientSignoff: "Signed", wbsUpdated: "Yes" } })).id;
  });

  afterAll(async () => {
    actAs(null);
    await prisma.project.deleteMany({ where: { id: { in: [projectA, projectB] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [pmA, clientA] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmA, clientA] } } });
  });

  it("refuses a log from someone without write access, or on another project", async () => {
    actAs(clientA);
    await expect(logChecklistOccurrence(recurring, { date: "2026-10-05", link: LINK })).rejects.toThrow();
    actAs(pmA);
    await expect(logChecklistOccurrence(inB, { date: "2026-10-05", link: LINK })).rejects.toThrow();
    actAs(null);
    await expect(logChecklistOccurrence(recurring, { date: "2026-10-05", link: LINK })).rejects.toThrow();
    expect(await prisma.checklistOccurrence.count({ where: { checklistItemId: { in: [recurring, inB] } } })).toBe(0);
  });

  it("refuses a missing or unsafe link, a missing date, and a one-time item", async () => {
    actAs(pmA);
    await expect(logChecklistOccurrence(recurring, { date: "2026-10-05", link: "" })).rejects.toThrow("Add a link");
    await expect(logChecklistOccurrence(recurring, { date: "2026-10-05", link: "javascript:alert(1)" })).rejects.toThrow();
    await expect(logChecklistOccurrence(recurring, { date: "", link: LINK })).rejects.toThrow("Choose the date");
    await expect(logChecklistOccurrence(oneTime, { date: "2026-10-05", link: LINK })).rejects.toThrow("ongoing cadence");
    expect(await prisma.checklistOccurrence.count({ where: { checklistItemId: recurring } })).toBe(0);
  });

  it("logs evidence, finds the sprint, keeps Last done on the newest log, and turns QMS Done", async () => {
    actAs(pmA);
    expect((await loadQmsReport(projectA)).byId.Q28.status).toBe("NOT_STARTED");

    await logChecklistOccurrence(recurring, { date: "2026-10-05", link: LINK, notes: "Sprint 1 retro" });
    await logChecklistOccurrence(recurring, { date: "2026-11-02", link: `${LINK}2` });
    await logChecklistOccurrence(recurring, { date: "2026-09-01", link: `${LINK}3` });

    const logs = await prisma.checklistOccurrence.findMany({ where: { checklistItemId: recurring }, orderBy: { date: "asc" } });
    expect(logs.map((l) => l.sprintId)).toEqual([null, sprint, null]);
    expect(logs[1].recordedByName).toBe("QMS PM");
    const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: recurring } });
    expect(item.actualDate).toEqual(new Date("2026-11-02T00:00:00"));

    const q28 = (await loadQmsReport(projectA)).byId.Q28;
    expect(q28.status).toBe("DONE");
    expect(q28.sources[0].logCount).toBe(3);
    expect(q28.sources[0].links[0].href).toBe(`${LINK}2`);
  });

  it("refuses removing a log without write access, and follows the newest log after removal", async () => {
    const newest = await prisma.checklistOccurrence.findFirstOrThrow({ where: { checklistItemId: recurring }, orderBy: { date: "desc" } });
    actAs(clientA);
    await expect(deleteChecklistOccurrence(newest.id)).rejects.toThrow();

    actAs(pmA);
    await deleteChecklistOccurrence(newest.id);
    expect((await prisma.checklistItem.findUniqueOrThrow({ where: { id: recurring } })).actualDate).toEqual(new Date("2026-10-05T00:00:00"));
  });

  it("goes back to Not started when the last log is removed", async () => {
    actAs(pmA);
    for (const log of await prisma.checklistOccurrence.findMany({ where: { checklistItemId: recurring } })) await deleteChecklistOccurrence(log.id);
    expect((await prisma.checklistItem.findUniqueOrThrow({ where: { id: recurring } })).actualDate).toBeNull();
    expect((await loadQmsReport(projectA)).byId.Q28.status).toBe("NOT_STARTED");
  });

  it("a one-time item follows its status and evidence, and reopening undoes Done", async () => {
    actAs(pmA);
    await updateChecklistItem(oneTime, { status: "COMPLETED" });
    expect((await loadQmsReport(projectA)).byId.Q1.status).toBe("EVIDENCE_MISSING");

    await prisma.checklistItem.update({ where: { id: oneTime }, data: { owner: "Ana" } });
    await updateChecklistItem(oneTime, { link: LINK });
    expect((await loadQmsReport(projectA)).byId.Q1.status).toBe("DONE");

    await updateChecklistItem(oneTime, { status: "IN_PROGRESS" });
    expect((await loadQmsReport(projectA)).byId.Q1.status).toBe("IN_PROGRESS");
  });

  it("CR evidence: Q33 needs the document, and an unsafe link is refused", async () => {
    actAs(pmA);
    expect((await loadQmsReport(projectA)).byId.Q33.status).toBe("EVIDENCE_MISSING");
    expect((await loadQmsReport(projectA)).byId.Q34.status).toBe("DONE");

    await expect(updateChangeRequest(crId, projectA, { documentLink: "javascript:alert(1)" })).rejects.toThrow();
    await updateChangeRequest(crId, projectA, { documentLink: LINK, timelineImpact: "Adds 3 days" });
    const cr = await prisma.changeRequest.findUniqueOrThrow({ where: { id: crId } });
    expect(cr.timelineImpact).toBe("Adds 3 days");
    expect((await loadQmsReport(projectA)).byId.Q33.status).toBe("DONE");
  });

  it("deleting a recurring item's project removes its logs", async () => {
    const temp = await prisma.project.create({ data: { name: "[TEST] QMS cascade" } });
    const it2 = await prisma.checklistItem.create({ data: { projectId: temp.id, type: "PM", order: 1, stage: "Development", itemText: "[TEST] x", isRecurring: true } });
    const log = await prisma.checklistOccurrence.create({ data: { checklistItemId: it2.id, date: new Date(), link: LINK } });
    await prisma.project.delete({ where: { id: temp.id } });
    expect(await prisma.checklistOccurrence.findUnique({ where: { id: log.id } })).toBeNull();
  });
});
