import { describe, it, expect } from "vitest";
import { scopeBreakdown, paceForecast, pickReleases } from "./delivery-forecast";

const sprints = [
  { id: "closed", startedAt: new Date("2026-10-07"), closedAt: new Date("2026-10-13") },
  { id: "running", startedAt: new Date("2026-10-14"), closedAt: null },
  { id: "draft", startedAt: null, closedAt: null },
];

describe("scopeBreakdown", () => {
  it("splits points into done, current sprint, later sprints and backlog — draft-sprint tasks aren't in progress", () => {
    const b = scopeBreakdown(
      [
        { storyPoints: 5, pctComplete: 1, sprintId: "closed" },
        { storyPoints: 4, pctComplete: 0.5, sprintId: "running" }, // 2 done, 2 left in current sprint
        { storyPoints: 3, pctComplete: 0, sprintId: "draft" },
        { storyPoints: 2, pctComplete: 0, sprintId: null },
        { storyPoints: 1, pctComplete: 0, sprintId: "closed" }, // unfinished in a closed sprint -> backlog
      ],
      sprints
    );
    expect(b).toEqual({
      total: 15,
      done: 7,
      inCurrentSprint: 2,
      plannedLater: 3,
      backlog: 3,
      tasks: { done: 1, inCurrentSprint: 1, plannedLater: 1, backlog: 2 },
    });
    expect(b.done + b.inCurrentSprint + b.plannedLater + b.backlog).toBe(b.total);
  });
});

describe("paceForecast", () => {
  const today = new Date("2026-10-15T15:00:00");

  it("projects the finish from the closed sprints' points per day (the DED case)", () => {
    // Sprint 0.1: Oct 7–13 (7 days), 10 points earned; 101.25 points left.
    const f = paceForecast([{ startDate: new Date("2026-10-07"), endDate: new Date("2026-10-13"), earnedPoints: 10 }], 101.25, today)!;
    expect(f.pointsPerWeek).toBeCloseTo(10);
    expect(f.basedOnSprints).toBe(1);
    // ceil(101.25 / (10/7)) = 71 days after Oct 15
    expect(f.finish.toDateString()).toBe(new Date("2026-12-25T00:00:00").toDateString());
  });

  it("no closed sprint, or nothing earned, means no forecast", () => {
    expect(paceForecast([], 50, today)).toBeNull();
    expect(paceForecast([{ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-07"), earnedPoints: 0 }], 50, today)).toBeNull();
  });

  it("nothing left finishes today", () => {
    const f = paceForecast([{ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-07"), earnedPoints: 5 }], 0, today)!;
    expect(f.finish.toDateString()).toBe(today.toDateString());
  });
});

describe("pickReleases", () => {
  const r = (id: string, deploymentStatus: string, releaseDate: string | null, createdAt: string) => ({
    id,
    deploymentStatus,
    releaseDate: releaseDate ? new Date(releaseDate) : null,
    createdAt: new Date(createdAt),
  });

  it("latest deployed by release date, next = soonest planned/in progress, sign-off from the deployed one", () => {
    const out = pickReleases([
      r("old", "Deployed", "2026-08-01", "2026-09-30"), // entered last, but released earliest
      r("new", "Deployed", "2026-09-15", "2026-09-01"),
      r("later", "Planned", "2026-12-01", "2026-10-01"),
      r("soon", "In Progress", "2026-11-01", "2026-10-05"),
      r("undated", "Planned", null, "2026-09-01"),
      r("failed", "Failed", "2026-10-01", "2026-10-01"),
    ]);
    expect(out.latestDeployed?.id).toBe("new");
    expect(out.next?.id).toBe("soon");
    expect(out.signoffFrom?.id).toBe("new");
  });

  it("with nothing deployed, sign-off comes from the next release; with nothing, all null", () => {
    expect(pickReleases([r("p", "Planned", "2026-11-01", "2026-10-01")]).signoffFrom?.id).toBe("p");
    expect(pickReleases([])).toEqual({ latestDeployed: null, next: null, signoffFrom: null });
  });
});
