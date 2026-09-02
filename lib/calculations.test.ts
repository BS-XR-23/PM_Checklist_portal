import { describe, it, expect } from "vitest";
import {
  currentStage,
  isSlipped,
  reminderBand,
  checklistCompletionPct,
  wbsPlannedValue,
  wbsActualValue,
  competencyCpi,
  budgetEntriesFromSprints,
  sprintEarnedValue,
  manDaysFromHours,
  sprintOwnHours,
  sprintTotalsFromContributions,
  roleBreakdownFromContributions,
  parseSprintContributions,
  type SprintTaskContribution,
  type SprintForBudget,
} from "./calculations";

function contribution(overrides: Partial<SprintTaskContribution> = {}): SprintTaskContribution {
  return {
    taskId: "t1",
    wbsNumber: "1.1",
    title: "Task",
    storyPoints: 0,
    pctComplete: 0,
    sprintOwnHours: 0,
    competencyMultiplier: 1,
    manDayRate: 0,
    roleName: null,
    ...overrides,
  };
}

function sprintForBudget(overrides: Partial<SprintForBudget> = {}): SprintForBudget {
  return {
    endDate: new Date("2026-01-14"),
    closedAt: null,
    frozenPlannedPoints: null,
    frozenEarnedPoints: null,
    frozenActualValue: null,
    frozenEntries: [],
    liveEntries: [],
    departedEntries: [],
    ...overrides,
  };
}

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
  it("sums estimated story points across tasks", () => {
    expect(wbsPlannedValue([{ points: 7 }, { points: 3.5 }])).toBe(10.5);
  });

  it("returns 0 for no tasks", () => {
    expect(wbsPlannedValue([])).toBe(0);
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

describe("sprintEarnedValue", () => {
  it("a task at exactly 100% earns its full story points", () => {
    expect(sprintEarnedValue([{ points: 10, pctComplete: 1 }])).toBe(10);
  });

  it("a task at 60% earns nothing — 0/100 rule, no partial credit", () => {
    expect(sprintEarnedValue([{ points: 10, pctComplete: 0.6 }])).toBe(0);
  });

  it("mixes done and not-done tasks correctly", () => {
    const tasks = [
      { points: 10, pctComplete: 1 },
      { points: 5, pctComplete: 0.99 },
      { points: 8, pctComplete: 1 },
    ];
    expect(sprintEarnedValue(tasks)).toBe(18);
  });

  it("returns 0 for an empty list", () => {
    expect(sprintEarnedValue([])).toBe(0);
  });
});

describe("manDaysFromHours", () => {
  it("converts hours to man-days using an 8-hour day", () => {
    expect(manDaysFromHours(16)).toBe(2);
    expect(manDaysFromHours(4)).toBe(0.5);
  });

  it("returns 0 for 0 hours", () => {
    expect(manDaysFromHours(0)).toBe(0);
  });
});

describe("sprintOwnHours", () => {
  it("subtracts the entry baseline from lifetime actualHours", () => {
    expect(sprintOwnHours(28, 20)).toBe(8);
  });

  it("clamps at 0 rather than going negative (e.g. a downward data-entry correction)", () => {
    expect(sprintOwnHours(15, 20)).toBe(0);
  });

  it("a freshly-committed task (baseline == current hours) starts at 0", () => {
    expect(sprintOwnHours(20, 20)).toBe(0);
  });
});

describe("sprintTotalsFromContributions / roleBreakdownFromContributions", () => {
  it("computes PV/EV/AV/cost from a list of contribution entries", () => {
    const entries = [
      contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, competencyMultiplier: 1, manDayRate: 100, roleName: "Engineer" }),
      contribution({ storyPoints: 5, pctComplete: 0.5, sprintOwnHours: 10, competencyMultiplier: 1, manDayRate: 100, roleName: "Engineer" }),
    ];
    const totals = sprintTotalsFromContributions(entries);
    expect(totals.plannedValue).toBe(15);
    expect(totals.earnedValue).toBe(10); // only the fully-done task earns (0/100 rule)
    expect(totals.actualValue).toBeCloseTo(6.25); // (40+10)/8 man-days x 1
    expect(totals.actualCost).toBeCloseTo(625); // (40+10)/8 man-days x 100
  });

  it("groups cost by role and drops roles with no hours logged", () => {
    const entries = [
      contribution({ sprintOwnHours: 16, manDayRate: 100, roleName: "Engineer" }),
      contribution({ sprintOwnHours: 8, manDayRate: 150, roleName: "Designer" }),
      contribution({ sprintOwnHours: 0, manDayRate: 200, roleName: "QA" }), // no hours — excluded
    ];
    const breakdown = roleBreakdownFromContributions(entries);
    expect(breakdown).toHaveLength(2);
    expect(breakdown.find((r) => r.roleName === "Engineer")).toMatchObject({ manDaysEquivalent: 2, cost: 200 });
    expect(breakdown.find((r) => r.roleName === "Designer")).toMatchObject({ manDaysEquivalent: 1, cost: 150 });
  });
});

describe("parseSprintContributions", () => {
  it("returns [] for anything that isn't an array (e.g. an unset Json column)", () => {
    expect(parseSprintContributions(null)).toEqual([]);
    expect(parseSprintContributions(undefined)).toEqual([]);
    expect(parseSprintContributions({})).toEqual([]);
  });

  it("fills in defaults for a pre-migration snapshot missing the newer fields", () => {
    const parsed = parseSprintContributions([{ taskId: "t1", wbsNumber: "1.1", title: "Old task", storyPoints: 5, pctComplete: 1 }]);
    expect(parsed).toEqual([
      { taskId: "t1", wbsNumber: "1.1", title: "Old task", storyPoints: 5, pctComplete: 1, sprintOwnHours: 0, competencyMultiplier: 1, manDayRate: 0, roleName: null },
    ]);
  });
});

describe("budgetEntriesFromSprints", () => {
  it("an open sprint computes PV/EV live from its tasks (0/100 rule)", () => {
    const sprints = [
      sprintForBudget({
        liveEntries: [
          contribution({ storyPoints: 10, pctComplete: 1 }),
          contribution({ storyPoints: 5, pctComplete: 0.5 }),
        ],
      }),
    ];
    const result = budgetEntriesFromSprints(sprints, 15);
    expect(result[0].pctPlannedComplete).toBeCloseTo(1); // (10+5) / 15
    expect(result[0].pctActualComplete).toBeCloseTo(10 / 15); // only the fully-done task earns
  });

  it("a closed sprint reads its frozen snapshot, ignoring the (possibly since-changed) live tasks", () => {
    const sprints = [
      sprintForBudget({
        closedAt: new Date("2026-01-15"),
        frozenPlannedPoints: 20,
        frozenEarnedPoints: 20,
        frozenActualValue: 18,
        frozenEntries: [contribution({ storyPoints: 20, pctComplete: 1 })],
        liveEntries: [contribution({ storyPoints: 999, pctComplete: 0 })], // since-changed — must be ignored
      }),
    ];
    const result = budgetEntriesFromSprints(sprints, 20);
    expect(result[0].pctPlannedComplete).toBe(1);
    expect(result[0].pctActualComplete).toBe(1);
  });

  it("cumulative planned/earned accumulate across sprints — no dedup needed, a task belongs to one sprint at a time", () => {
    const sprints = [
      sprintForBudget({
        closedAt: new Date("2026-01-15"),
        frozenPlannedPoints: 10,
        frozenEarnedPoints: 10,
        frozenActualValue: 8,
      }),
      sprintForBudget({
        endDate: new Date("2026-01-28"),
        liveEntries: [contribution({ storyPoints: 10, pctComplete: 1 })],
      }),
    ];
    const result = budgetEntriesFromSprints(sprints, 20);
    expect(result[0].pctPlannedComplete).toBeCloseTo(0.5); // 10 / 20
    expect(result[1].pctPlannedComplete).toBeCloseTo(1); // (10 + 10) / 20 cumulative
    expect(result[1].pctActualComplete).toBeCloseTo(1);
  });

  it("actualCost is that sprint's own spend only, not cumulative", () => {
    const sprints = [
      sprintForBudget({ liveEntries: [contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, manDayRate: 100 })] }), // 5 md x 100
      sprintForBudget({ endDate: new Date("2026-01-28"), liveEntries: [contribution({ storyPoints: 5, pctComplete: 1, sprintOwnHours: 16, manDayRate: 100 })] }), // 2 md x 100
    ];
    const result = budgetEntriesFromSprints(sprints, 15);
    expect(result[0].actualCost).toBe(500);
    expect(result[1].actualCost).toBe(200); // not 700 — sprint 2 only spent 200 of its own
  });

  it("a closed sprint's actualCost comes from the frozen snapshot, not the live (possibly rate-changed) tasks", () => {
    const sprints = [
      sprintForBudget({
        closedAt: new Date("2026-01-15"),
        frozenPlannedPoints: 10,
        frozenEarnedPoints: 10,
        frozenActualValue: 5,
        frozenEntries: [contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, manDayRate: 100 })], // frozen at 5 md x 100 = 500
        liveEntries: [contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, manDayRate: 250 })], // rate since raised — must be ignored
      }),
    ];
    const result = budgetEntriesFromSprints(sprints, 10);
    expect(result[0].actualCost).toBe(500);
  });

  it("an open sprint's totals include a task that departed it mid-flight, not just its still-live tasks", () => {
    const sprints = [
      sprintForBudget({
        liveEntries: [contribution({ taskId: "still-here", storyPoints: 5, pctComplete: 1, sprintOwnHours: 8, manDayRate: 100 })],
        departedEntries: [contribution({ taskId: "moved-away", storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, manDayRate: 100 })],
      }),
    ];
    const result = budgetEntriesFromSprints(sprints, 15);
    expect(result[0].pctPlannedComplete).toBeCloseTo(1); // (5 + 10) / 15 — the departed task still counts
    expect(result[0].pctActualComplete).toBeCloseTo(1);
    expect(result[0].actualCost).toBe(600); // (8+40)/8 md x 100
  });

  it("plannedStoryPoints = 0 doesn't divide by zero", () => {
    const sprints = [sprintForBudget({ liveEntries: [contribution({ storyPoints: 10, pctComplete: 1 })] })];
    const result = budgetEntriesFromSprints(sprints, 0);
    expect(result[0].pctPlannedComplete).toBe(0);
    expect(result[0].pctActualComplete).toBe(0);
  });

  it("returns an empty array for no sprints", () => {
    expect(budgetEntriesFromSprints([], 10)).toEqual([]);
  });
});
