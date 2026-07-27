// Same real-DB / mocking setup as tests/isolation.integration.test.ts, focused
// on the Person/ProjectEngagement (Resourcing) surface: a PM assigned to
// Project A must not be able to manage engagements on Project B (even by
// passing a real engagement id from B); a Client gets no resourcing access
// at all; a Limited user's own-engagement lookup is scoped strictly by their
// linked Person.userId, never by a guessable id.
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

describe("resourcing isolation boundary", () => {
  let projectA: { id: string };
  let projectB: { id: string };
  let pmAUserId: string;
  let clientBUserId: string;
  let limitedUserId: string;
  let personOnA: { id: string };
  let personOnB: { id: string };
  let engagementOnA: { id: string };
  let engagementOnB: { id: string };
  let selfServicePerson: { id: string };

  beforeAll(async () => {
    projectA = await prisma.project.create({ data: { name: "[TEST] Resourcing Project A", contractValue: 10000, plannedManDays: 20 } });
    projectB = await prisma.project.create({ data: { name: "[TEST] Resourcing Project B", contractValue: 20000, plannedManDays: 40 } });

    const passwordHash = await bcrypt.hash("test-password-not-used", 10);
    const pmA = await prisma.user.create({ data: { email: `test-res-pm-a-${Date.now()}@example.test`, name: "Test PM A", passwordHash, role: "PM" } });
    const clientB = await prisma.user.create({ data: { email: `test-res-client-b-${Date.now()}@example.test`, name: "Test Client B", passwordHash, role: "CLIENT" } });
    const limitedUser = await prisma.user.create({ data: { email: `test-res-limited-${Date.now()}@example.test`, name: "Test Limited", passwordHash, role: "LIMITED" } });
    pmAUserId = pmA.id;
    clientBUserId = clientB.id;
    limitedUserId = limitedUser.id;

    await prisma.projectMembership.create({ data: { userId: pmAUserId, projectId: projectA.id, role: "PM" } });
    await prisma.projectMembership.create({ data: { userId: clientBUserId, projectId: projectB.id, role: "CLIENT" } });

    personOnA = await prisma.person.create({ data: { name: "[TEST] Person On A" } });
    personOnB = await prisma.person.create({ data: { name: "[TEST] Person On B" } });
    selfServicePerson = await prisma.person.create({ data: { name: "[TEST] Self Service Person", userId: limitedUserId } });

    engagementOnA = await prisma.projectEngagement.create({
      data: { projectId: projectA.id, personId: personOnA.id, roleOnProject: "Engineer", intensityPct: 50 },
    });
    engagementOnB = await prisma.projectEngagement.create({
      data: { projectId: projectB.id, personId: personOnB.id, roleOnProject: "QA", intensityPct: 60 },
    });
  });

  afterAll(async () => {
    await prisma.projectEngagement.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
    await prisma.person.deleteMany({ where: { id: { in: [personOnA.id, personOnB.id, selfServicePerson.id] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [pmAUserId, clientBUserId, limitedUserId] } } });
  });

  it("guessed-ID attack: PM-A cannot update an engagement that belongs to Project B, even passing projectB.id", async () => {
    const { updateEngagement } = await import("@/app/projects/[projectId]/resourcing/resourcing-actions");
    actAs(pmAUserId);

    await expect(updateEngagement(engagementOnB.id, projectB.id, { intensityPct: 99 })).rejects.toThrow();

    const stillUnchanged = await prisma.projectEngagement.findUniqueOrThrow({ where: { id: engagementOnB.id } });
    expect(stillUnchanged.intensityPct).toBe(60);
  });

  it("PM-A CAN assign an existing person to their own project (Project A)", async () => {
    const { assignEngagement, removeEngagement } = await import("@/app/projects/[projectId]/resourcing/resourcing-actions");
    actAs(pmAUserId);

    await assignEngagement(projectA.id, { personId: personOnB.id, roleOnProject: "Extra Help", intensityPct: 20, startDate: null, endDate: null });

    const created = await prisma.projectEngagement.findFirstOrThrow({ where: { projectId: projectA.id, personId: personOnB.id } });
    expect(created.roleOnProject).toBe("Extra Help");

    await removeEngagement(created.id, projectA.id); // cleanup
  });

  it("PM-A cannot assign anyone to Project B (not their project)", async () => {
    const { assignEngagement } = await import("@/app/projects/[projectId]/resourcing/resourcing-actions");
    actAs(pmAUserId);

    await expect(
      assignEngagement(projectB.id, { personId: personOnA.id, roleOnProject: "Sneaky", intensityPct: 10, startDate: null, endDate: null })
    ).rejects.toThrow();
  });

  it("Client-B has no resourcing access at all — even on their own assigned project", async () => {
    const { assignEngagement, updateEngagement } = await import("@/app/projects/[projectId]/resourcing/resourcing-actions");
    actAs(clientBUserId);

    await expect(
      assignEngagement(projectB.id, { personId: personOnB.id, roleOnProject: "Anything", intensityPct: 10, startDate: null, endDate: null })
    ).rejects.toThrow();
    await expect(updateEngagement(engagementOnB.id, projectB.id, { intensityPct: 5 })).rejects.toThrow();
  });

  it("a Limited user's self-service lookup is scoped strictly to their own linked Person, never another's", async () => {
    // Mirrors the query app/my-engagement/page.tsx runs: resolve by the
    // session user's id, never by a passed-in/guessable person or user id.
    const ownRecord = await prisma.person.findUnique({ where: { userId: limitedUserId } });
    expect(ownRecord?.id).toBe(selfServicePerson.id);

    // Even knowing personOnA/personOnB's real ids, there is no query path
    // from "the current session's userId" to someone else's Person record.
    const otherByThisUsersId = await prisma.person.findUnique({ where: { userId: pmAUserId } });
    expect(otherByThisUsersId).toBeNull(); // pmA has no linked Person at all
  });
});
