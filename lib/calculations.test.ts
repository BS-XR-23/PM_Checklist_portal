import { describe, it, expect } from "vitest";
import {
  currentStage,
  isSlipped,
  reminderBand,
  checklistCompletionPct,
  isTrackedChecklistItem,
  wbsPlannedValue,
  wbsActualValue,
  competencyCpi,
  budgetEntriesFromSprints,
  runningSprintBudget,
  computeEvm,
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
    startedAt: new Date("2026-01-01"),
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

  it("due today is DUE_SOON all day, not OVERDUE once the clock passes midnight", () => {
    const afternoon = new Date("2026-07-30T15:00:00");
    expect(reminderBand(new Date("2026-07-30T00:00:00"), false, afternoon)).toBe("DUE_SOON");
    expect(reminderBand(new Date("2026-07-29T00:00:00"), false, afternoon)).toBe("OVERDUE");
    expect(reminderBand(new Date("2026-08-06T00:00:00"), false, afternoon)).toBe("DUE_SOON");
    expect(reminderBand(new Date("2026-08-07T00:00:00"), false, afternoon)).toBeNull();
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

// A closed sprint whose frozen numbers come from its own contributions.
function closedSprint(entries: SprintTaskContribution[], overrides: Partial<SprintForBudget> = {}): SprintForBudget {
  const points = entries.reduce((sum, e) => sum + e.storyPoints, 0);
  const earned = entries.reduce((sum, e) => sum + (e.pctComplete >= 1 ? e.storyPoints : 0), 0);
  return sprintForBudget({ closedAt: new Date("2026-01-15"), frozenPlannedPoints: points, frozenEarnedPoints: earned, frozenActualValue: 1, frozenEntries: entries, ...overrides });
}

describe("budgetEntriesFromSprints", () => {
  it("only CLOSED sprints get a data point — running and draft sprints are left out (same rule as Delivery's SPI)", () => {
    const sprints = [
      closedSprint([contribution({ storyPoints: 10, pctComplete: 1 })]),
      sprintForBudget({ endDate: new Date("2026-01-28"), liveEntries: [contribution({ storyPoints: 10, pctComplete: 0.5 })] }), // running
      sprintForBudget({ endDate: new Date("2026-02-11"), startedAt: null, liveEntries: [contribution({ storyPoints: 8 })] }), // draft
    ];
    const result = budgetEntriesFromSprints(sprints, 20);
    expect(result).toHaveLength(1);
    expect(result[0].pctPlannedComplete).toBeCloseTo(0.5);
    expect(result[0].pctActualComplete).toBeCloseTo(0.5);
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

  it("cumulative planned/earned accumulate across closed sprints", () => {
    const sprints = [
      closedSprint([contribution({ storyPoints: 10, pctComplete: 1 })]),
      closedSprint([contribution({ storyPoints: 10, pctComplete: 1 })], { endDate: new Date("2026-01-28") }),
    ];
    const result = budgetEntriesFromSprints(sprints, 20);
    expect(result[0].pctPlannedComplete).toBeCloseTo(0.5); // 10 / 20
    expect(result[1].pctPlannedComplete).toBeCloseTo(1); // (10 + 10) / 20 cumulative
    expect(result[1].pctActualComplete).toBeCloseTo(1);
  });

  it("actualCost is cumulative (like PV/EV); sprintActualCost is the sprint's own spend", () => {
    const sprints = [
      closedSprint([contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40, manDayRate: 100 })]), // 5 md x 100
      closedSprint([contribution({ storyPoints: 5, pctComplete: 1, sprintOwnHours: 16, manDayRate: 100 })], { endDate: new Date("2026-01-28") }), // 2 md x 100
    ];
    const result = budgetEntriesFromSprints(sprints, 15);
    expect(result[0].actualCost).toBe(500);
    expect(result[1].actualCost).toBe(700); // 500 + 200, cumulative
    expect(result[1].sprintActualCost).toBe(200);
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
    expect(budgetEntriesFromSprints(sprints, 10)[0].actualCost).toBe(500);
  });

  it("counts hours from assignees with no role rate as uncosted instead of silently costing them $0", () => {
    const sprints = [
      closedSprint([
        contribution({ storyPoints: 5, pctComplete: 1, sprintOwnHours: 16, manDayRate: 100 }),
        contribution({ taskId: "t2", storyPoints: 5, pctComplete: 1, sprintOwnHours: 12, manDayRate: 0, roleName: null }),
      ]),
    ];
    const [entry] = budgetEntriesFromSprints(sprints, 10);
    expect(entry.actualCost).toBe(200); // only the costed 2 md
    expect(entry.uncostedHours).toBe(12);
  });

  it("a zero baseline doesn't divide by zero", () => {
    const result = budgetEntriesFromSprints([closedSprint([contribution({ storyPoints: 10, pctComplete: 1 })])], 0);
    expect(result[0].pctPlannedComplete).toBe(0);
    expect(result[0].pctActualComplete).toBe(0);
  });

  it("returns an empty array for no sprints", () => {
    expect(budgetEntriesFromSprints([], 10)).toEqual([]);
  });
});

describe("runningSprintBudget", () => {
  it("live totals of the running sprint (0/100 rule), including tasks that departed it mid-flight", () => {
    const sprints = [
      closedSprint([contribution({ storyPoints: 10, pctComplete: 1 })]),
      sprintForBudget({
        liveEntries: [contribution({ taskId: "still-here", storyPoints: 5, pctComplete: 1, sprintOwnHours: 8, manDayRate: 100 })],
        departedEntries: [contribution({ taskId: "moved-away", storyPoints: 10, pctComplete: 0.5, sprintOwnHours: 40, manDayRate: 100 })],
      }),
    ];
    const r = runningSprintBudget(sprints, 1_000, 20)!; // $50 per point
    expect(r.committedPoints).toBe(15);
    expect(r.earnedPoints).toBe(5); // only the 100% task earns
    expect(r.plannedValue).toBe(750);
    expect(r.earnedValue).toBe(250);
    expect(r.actualCost).toBe(600); // (8 + 40) / 8 md x 100
  });

  it("is null when nothing is running — a draft sprint doesn't count", () => {
    expect(runningSprintBudget([sprintForBudget({ startedAt: null, liveEntries: [contribution({ storyPoints: 8 })] })], 1_000, 10)).toBeNull();
  });
});

describe("computeEvm", () => {
  it("reports gross margin on earned work, not a price-vs-cost 'CPI'", () => {
    // Contract $1,000 for 10 points ($100/point). 5 points earned for 2 md at $100 = $200 cost.
    const [p] = computeEvm(budgetEntriesFromSprints([closedSprint([contribution({ storyPoints: 5, pctComplete: 1, sprintOwnHours: 16, manDayRate: 100 })])], 10), 1_000);
    expect(p.ev).toBe(500);
    expect(p.actualCost).toBe(200);
    expect(p.cv).toBe(300);
    expect(p.margin).toBeCloseTo(0.6);
    expect(p.spi).toBe(1);
  });

  it("margin is null until something is earned", () => {
    const [p] = computeEvm([{ weekEnding: new Date(), pctPlannedComplete: 0.5, pctActualComplete: 0, actualCost: 100 }], 1_000);
    expect(p.margin).toBeNull();
    expect(p.spi).toBe(0);
  });
});

describe("recurring cadence items (isTrackedChecklistItem)", () => {
  it("are excluded from completion % — never 'done', so they can't drag it down", () => {
    expect(
      checklistCompletionPct([
        { status: "COMPLETED" },
        { status: "NOT_STARTED", isRecurring: true },
        { status: "NOT_STARTED", isRecurring: true },
      ])
    ).toBe(1);
  });

  it("regression: don't pin the current stage to the first stage that holds one", () => {
    const STAGES = ["Governance", "Planning", "Closure"] as const;
    const items = [
      { stage: "Governance", status: "COMPLETED" },
      { stage: "Governance", status: "IN_PROGRESS", isRecurring: true }, // weekly CPI/SPI report
      { stage: "Planning", status: "IN_PROGRESS" },
    ];
    expect(currentStage(items, STAGES)).toBe("Planning"); // was "Governance" forever
  });

  it("a stage holding only recurring items is skipped entirely", () => {
    expect(currentStage([{ stage: "Governance", status: "NOT_STARTED", isRecurring: true }], ["Governance"])).toBeNull();
  });

  it("isTrackedChecklistItem: N/A and recurring are untracked, everything else is tracked", () => {
    expect(isTrackedChecklistItem({ status: "NOT_STARTED" })).toBe(true);
    expect(isTrackedChecklistItem({ status: "NOT_APPLICABLE" })).toBe(false);
    expect(isTrackedChecklistItem({ status: "COMPLETED", isRecurring: true })).toBe(false);
  });
});
