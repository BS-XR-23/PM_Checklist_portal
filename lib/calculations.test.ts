import { describe, it, expect } from "vitest";
import {
  currentStage,
  isSlipped,
  reminderBand,
  checklistCompletionPct,
  wbsPlannedValue,
  wbsEarnedValue,
  wbsActualValue,
  competencyCpi,
  budgetEntriesFromWbs,
} from "./calculations";

describe("currentStage", () => {
  const STAGES = ["Planning", "Development", "Release"] as const;

  it("returns the first stage with an incomplete item", () => {
    const items = [
      { stage: "Planning", status: "COMPLETED" },
      { stage: "Development", status: "IN_PROGRESS" },
      { stage: "Release", status: "NOT_STARTED" },
    ];
    expect(currentStage(items, STAGES)).toBe("Development");
  });

  it("a stage that's all COMPLETED or NOT_APPLICABLE counts as done — moves to the next stage", () => {
    const items = [
      { stage: "Planning", status: "COMPLETED" },
      { stage: "Development", status: "NOT_APPLICABLE" },
      { stage: "Release", status: "NOT_STARTED" },
    ];
    expect(currentStage(items, STAGES)).toBe("Release");
  });

  it("returns null when every item is COMPLETED or NOT_APPLICABLE", () => {
    const items = [
      { stage: "Planning", status: "COMPLETED" },
      { stage: "Development", status: "NOT_APPLICABLE" },
      { stage: "Release", status: "COMPLETED" },
    ];
    expect(currentStage(items, STAGES)).toBeNull();
  });

  it("skips stages with no items at all", () => {
    const items = [{ stage: "Release", status: "NOT_STARTED" }];
    expect(currentStage(items, STAGES)).toBe("Release");
  });
});

describe("isSlipped", () => {
  const planned = new Date("2026-01-01");
  const actualPastDue = new Date("2026-02-01");

  it("flags an actual date that's slipped past the planned date on an incomplete item", () => {
    expect(isSlipped(planned, actualPastDue, "IN_PROGRESS")).toBe(true);
  });

  it("never flags a COMPLETED item, even if the actual date slipped", () => {
    expect(isSlipped(planned, actualPastDue, "COMPLETED")).toBe(false);
  });

  it("never flags a NOT_APPLICABLE item, even if the actual date slipped", () => {
    expect(isSlipped(planned, actualPastDue, "NOT_APPLICABLE")).toBe(false);
  });

  it("no flag when either date is missing", () => {
    expect(isSlipped(null, actualPastDue, "IN_PROGRESS")).toBe(false);
    expect(isSlipped(planned, null, "IN_PROGRESS")).toBe(false);
  });
});

describe("reminderBand", () => {
  const today = new Date("2026-07-30");

  it("flags a past Planned Date as OVERDUE", () => {
    expect(reminderBand(new Date("2026-07-20"), false, today)).toBe("OVERDUE");
  });

  it("flags today and within the next 7 days as DUE_SOON", () => {
    expect(reminderBand(new Date("2026-07-30"), false, today)).toBe("DUE_SOON");
    expect(reminderBand(new Date("2026-08-06"), false, today)).toBe("DUE_SOON");
  });

  it("does not flag a Planned Date more than 7 days out", () => {
    expect(reminderBand(new Date("2026-08-07"), false, today)).toBeNull();
  });

  it("does not flag when there's no Planned Date", () => {
    expect(reminderBand(null, false, today)).toBeNull();
  });

  it("never flags a done item, even if overdue", () => {
    expect(reminderBand(new Date("2026-07-01"), true, today)).toBeNull();
  });
});

describe("checklistCompletionPct", () => {
  it("excludes NOT_APPLICABLE items from both numerator and denominator", () => {
    const items = [
      { status: "COMPLETED" },
      { status: "COMPLETED" },
      { status: "NOT_APPLICABLE" },
      { status: "IN_PROGRESS" },
    ];
    // 2 completed / 3 applicable, not / 4 total
    expect(checklistCompletionPct(items)).toBeCloseTo(2 / 3);
  });

  it("returns 0 when there are no items", () => {
    expect(checklistCompletionPct([])).toBe(0);
  });

  it("returns 0 when every item is NOT_APPLICABLE (no applicable items at all)", () => {
    expect(checklistCompletionPct([{ status: "NOT_APPLICABLE" }, { status: "NOT_APPLICABLE" }])).toBe(0);
  });

  it("returns 1 when every applicable item is COMPLETED", () => {
    expect(checklistCompletionPct([{ status: "COMPLETED" }, { status: "NOT_APPLICABLE" }])).toBe(1);
  });
});

describe("wbsPlannedValue", () => {
  it("sums estimated man-days across tasks", () => {
    expect(wbsPlannedValue([{ manDays: 7 }, { manDays: 3.5 }])).toBe(10.5);
  });

  it("returns 0 for no tasks", () => {
    expect(wbsPlannedValue([])).toBe(0);
  });
});

describe("wbsEarnedValue", () => {
  it("sums man-days weighted by % complete", () => {
    const tasks = [
      { manDays: 10, pctComplete: 0.7 },
      { manDays: 4, pctComplete: 0.5 },
    ];
    expect(wbsEarnedValue(tasks)).toBe(10 * 0.7 + 4 * 0.5);
  });

  it("a 0% task contributes nothing", () => {
    expect(wbsEarnedValue([{ manDays: 10, pctComplete: 0 }])).toBe(0);
  });
});

describe("wbsActualValue", () => {
  it("sums real days spent weighted by each assignee's competency multiplier", () => {
    const tasks = [
      { actualManDays: 4, competencyMultiplier: 1.3 }, // Senior
      { actualManDays: 2, competencyMultiplier: 1 }, // Mid/baseline
    ];
    expect(wbsActualValue(tasks)).toBeCloseTo(4 * 1.3 + 2 * 1, 5);
  });

  it("returns 0 for no tasks", () => {
    expect(wbsActualValue([])).toBe(0);
  });
});

describe("competencyCpi", () => {
  it("EV/AV > 1 means over-estimated — took less effort than planned", () => {
    expect(competencyCpi(10, 5)).toBe(2);
  });

  it("EV/AV < 1 means under-estimated — took more effort than planned", () => {
    expect(competencyCpi(5, 10)).toBe(0.5);
  });

  it("returns null when nothing has been logged yet (AV = 0), not Infinity", () => {
    expect(competencyCpi(10, 0)).toBeNull();
  });
});

describe("budgetEntriesFromWbs", () => {
  it("a task tracked across multiple weeks isn't double-counted in cumulative PV/EV", () => {
    const weeks = [
      { weekEnding: new Date("2026-01-01"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.3, actualManDays: 3, manDayRate: 100 }] },
      { weekEnding: new Date("2026-01-08"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.6, actualManDays: 3, manDayRate: 100 }] },
    ];
    const result = budgetEntriesFromWbs(weeks, 10);
    // If t1 were summed once per week instead of deduped, week 2's cumulative
    // manDays would be 20, not 10 — pctPlannedComplete would wrongly exceed 1.
    expect(result[1].pctPlannedComplete).toBe(1); // 10 manDays / 10 plannedManDays, not 20/10
    expect(result[1].pctActualComplete).toBeCloseTo(0.6); // 10 x 0.6 / 10
  });

  it("a task untouched in a given week carries forward its last-recorded state", () => {
    const weeks = [
      { weekEnding: new Date("2026-01-01"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.5, actualManDays: 5, manDayRate: 100 }] },
      { weekEnding: new Date("2026-01-08"), entries: [] }, // t1 not touched this week
    ];
    const result = budgetEntriesFromWbs(weeks, 10);
    expect(result[1].pctPlannedComplete).toBe(1); // t1's manDays still counted
    expect(result[1].pctActualComplete).toBeCloseTo(0.5); // t1's last-known % carried forward
  });

  it("actualCost is this week's spend only, not cumulative", () => {
    const weeks = [
      { weekEnding: new Date("2026-01-01"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.3, actualManDays: 3, manDayRate: 100 }] },
      { weekEnding: new Date("2026-01-08"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.6, actualManDays: 2, manDayRate: 100 }] },
    ];
    const result = budgetEntriesFromWbs(weeks, 10);
    expect(result[0].actualCost).toBe(3 * 100);
    expect(result[1].actualCost).toBe(2 * 100); // not 5 x 100 — week 2 only logged 2 more man-days
  });

  it("plannedManDays = 0 doesn't divide by zero", () => {
    const weeks = [{ weekEnding: new Date("2026-01-01"), entries: [{ wbsTaskId: "t1", manDays: 10, pctComplete: 0.5, actualManDays: 5, manDayRate: 100 }] }];
    const result = budgetEntriesFromWbs(weeks, 0);
    expect(result[0].pctPlannedComplete).toBe(0);
    expect(result[0].pctActualComplete).toBe(0);
  });

  it("returns an empty array for no weeks", () => {
    expect(budgetEntriesFromWbs([], 10)).toEqual([]);
  });
});
