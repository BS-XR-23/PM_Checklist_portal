import { describe, it, expect } from "vitest";
import { isCurrentlyActive, computePersonLoad, findOverlapConflicts, type EngagementLike } from "./overload";

const TODAY = new Date("2026-07-24T00:00:00Z");

function eng(overrides: Partial<EngagementLike> & { id: string }): EngagementLike {
  return {
    projectId: "proj-1",
    projectName: "Project 1",
    roleOnProject: "Engineer",
    intensityPct: 50,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

describe("isCurrentlyActive", () => {
  it("open-ended (no start/end) is always active", () => {
    expect(isCurrentlyActive({ startDate: null, endDate: null }, TODAY)).toBe(true);
  });

  it("future startDate is not yet active", () => {
    expect(isCurrentlyActive({ startDate: new Date("2026-08-01"), endDate: null }, TODAY)).toBe(false);
  });

  it("past endDate is no longer active", () => {
    expect(isCurrentlyActive({ startDate: null, endDate: new Date("2026-01-01") }, TODAY)).toBe(false);
  });

  it("today within [start, end] is active", () => {
    expect(isCurrentlyActive({ startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }, TODAY)).toBe(true);
  });
});

describe("computePersonLoad", () => {
  it("sums only currently-active engagements, ignoring past/future ones", () => {
    const engagements = [
      eng({ id: "1", intensityPct: 50 }),
      eng({ id: "2", intensityPct: 30, endDate: new Date("2026-01-01") }), // expired, excluded
      eng({ id: "3", intensityPct: 20 }),
    ];
    const load = computePersonLoad(engagements, TODAY);
    expect(load.totalActivePct).toBe(70);
    expect(load.activeEngagements.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("flags overloaded only when the active total exceeds the threshold (100)", () => {
    expect(computePersonLoad([eng({ id: "1", intensityPct: 100 })], TODAY).isOverloaded).toBe(false);
    expect(computePersonLoad([eng({ id: "1", intensityPct: 60 }), eng({ id: "2", intensityPct: 41 })], TODAY).isOverloaded).toBe(true);
  });
});

describe("findOverlapConflicts", () => {
  it("flags two high-intensity (>=60) engagements on DIFFERENT projects with overlapping dates", () => {
    const engagements = [
      eng({ id: "1", projectId: "A", intensityPct: 80, startDate: new Date("2026-07-01"), endDate: new Date("2026-07-31") }),
      eng({ id: "2", projectId: "B", intensityPct: 70, startDate: new Date("2026-07-15"), endDate: new Date("2026-08-15") }),
    ];
    const conflicts = findOverlapConflicts(engagements);
    expect(conflicts).toHaveLength(1);
    expect([conflicts[0].a.id, conflicts[0].b.id].sort()).toEqual(["1", "2"]);
  });

  it("does not flag when date ranges don't overlap", () => {
    const engagements = [
      eng({ id: "1", projectId: "A", intensityPct: 80, startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") }),
      eng({ id: "2", projectId: "B", intensityPct: 70, startDate: new Date("2026-07-01"), endDate: new Date("2026-07-31") }),
    ];
    expect(findOverlapConflicts(engagements)).toHaveLength(0);
  });

  it("does not flag when only one engagement is high-intensity", () => {
    const engagements = [
      eng({ id: "1", projectId: "A", intensityPct: 80 }),
      eng({ id: "2", projectId: "B", intensityPct: 40 }),
    ];
    expect(findOverlapConflicts(engagements)).toHaveLength(0);
  });

  it("ignores two high-intensity rows on the SAME project (not a cross-project conflict)", () => {
    const engagements = [
      eng({ id: "1", projectId: "A", intensityPct: 80 }),
      eng({ id: "2", projectId: "A", intensityPct: 70 }),
    ];
    expect(findOverlapConflicts(engagements)).toHaveLength(0);
  });

  it("open-ended date ranges (null start/end) are treated as always-overlapping", () => {
    const engagements = [
      eng({ id: "1", projectId: "A", intensityPct: 80, startDate: null, endDate: null }),
      eng({ id: "2", projectId: "B", intensityPct: 70, startDate: new Date("2030-01-01"), endDate: null }),
    ];
    expect(findOverlapConflicts(engagements)).toHaveLength(1);
  });
});
