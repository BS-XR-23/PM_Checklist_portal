import { describe, it, expect } from "vitest";
import type { SprintForBudget, SprintTaskContribution } from "./calculations";
import {
  computeProjectHealth,
  countOverdueMilestones,
  deliveryIndices,
  deliveryPct,
  governancePct,
  wbsBaselinePoints,
} from "./project-health";

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

function sprint(overrides: Partial<SprintForBudget> = {}): SprintForBudget {
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

const TODAY = new Date("2026-06-01");
const highRisk = { type: "Risk", status: "Open", probability: "High", impact: "High" };

describe("governancePct", () => {
  it("excludes Not Applicable items from both sides", () => {
    expect(governancePct([{ status: "COMPLETED" }, { status: "NOT_STARTED" }, { status: "NOT_APPLICABLE" }])).toBeCloseTo(0.5);
  });
});

describe("deliveryPct / wbsBaselinePoints", () => {
  it("weights progress by story points, not task count", () => {
    const tasks = [
      { storyPoints: 8, pctComplete: 1 },
      { storyPoints: 0.25, pctComplete: 0 },
      { storyPoints: 0.25, pctComplete: 0 },
    ];
    expect(wbsBaselinePoints(tasks)).toBe(8.5);
    expect(deliveryPct(tasks)).toBeCloseTo(8 / 8.5); // a task-count average would say 33%
  });

  it("is null (not 0%) when the WBS has no points to measure against", () => {
    expect(deliveryPct([])).toBeNull();
    expect(deliveryPct([{ storyPoints: 0, pctComplete: 1 }])).toBeNull();
  });

  it("caps a task's progress at 100%", () => {
    expect(deliveryPct([{ storyPoints: 4, pctComplete: 1.5 }])).toBe(1);
  });
});

describe("deliveryIndices", () => {
  it("has no SPI or Effort Index before any sprint starts — Draft sprints contribute nothing", () => {
    const idx = deliveryIndices([sprint({ startedAt: null, liveEntries: [contribution({ storyPoints: 5, pctComplete: 1, sprintOwnHours: 8 })] })]);
    expect(idx.spi).toBeNull();
    expect(idx.effortIndex).toBeNull();
    expect(idx.spiHistory).toEqual([]);
  });

  it("SPI is cumulative earned ÷ committed points across sprints", () => {
    const idx = deliveryIndices([
      sprint({ closedAt: new Date("2026-01-14"), frozenPlannedPoints: 10, frozenEarnedPoints: 10, frozenActualValue: 10 }),
      sprint({ endDate: new Date("2026-01-28"), liveEntries: [contribution({ storyPoints: 10, pctComplete: 0.5 })] }), // 0/100: earns 0
    ]);
    expect(idx.spi).toBeCloseTo(10 / 20);
    expect(idx.scheduleVariancePts).toBe(-10);
    expect(idx.spiHistory.map((h) => h.spi)).toEqual([1, 0.5]);
  });

  it("Effort Index is earned points ÷ competency-adjusted man-days", () => {
    // 10 points earned for 40h (5 md) at a 1.0 multiplier -> 10 / 5 = 2
    const idx = deliveryIndices([sprint({ liveEntries: [contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 40 })] })]);
    expect(idx.effortIndex).toBeCloseTo(2);
  });
});

describe("countOverdueMilestones", () => {
  it("counts only not-done milestones whose planned date has passed", () => {
    expect(
      countOverdueMilestones(
        [
          { status: "NOT_STARTED", plannedDate: new Date("2026-05-01") }, // overdue
          { status: "COMPLETED", plannedDate: new Date("2026-05-01") }, // done
          { status: "NOT_APPLICABLE", plannedDate: new Date("2026-05-01") }, // out of scope
          { status: "IN_PROGRESS", plannedDate: new Date("2026-07-01") }, // future
          { status: "NOT_STARTED", plannedDate: null }, // undated
        ],
        TODAY
      )
    ).toBe(1);
  });

  it("uses the forecast date when a milestone has been re-forecast", () => {
    expect(countOverdueMilestones([{ status: "IN_PROGRESS", plannedDate: new Date("2026-05-01"), forecastDate: new Date("2026-07-01") }], TODAY)).toBe(0);
    expect(countOverdueMilestones([{ status: "IN_PROGRESS", plannedDate: new Date("2026-07-01"), forecastDate: new Date("2026-05-01") }], TODAY)).toBe(1);
  });
});

describe("computeProjectHealth", () => {
  it("regression: an on-schedule project with logged hours is GREEN — never RED from a 0.00 CPI", () => {
    // The old RAG used Budget Tracker's dollar CPI with a 0 story-point
    // baseline: EV = 0, AC > 0 -> CPI 0.00 -> RED on every project.
    const health = computeProjectHealth({
      sprints: [
        sprint({
          closedAt: new Date("2026-01-14"),
          frozenPlannedPoints: 10,
          frozenEarnedPoints: 10,
          frozenActualValue: 7.8,
          frozenEntries: [contribution({ storyPoints: 10, pctComplete: 1, sprintOwnHours: 62, manDayRate: 150 })],
        }),
      ],
      risks: [],
      milestones: [],
      today: TODAY,
    });
    expect(health.rag).toBe("GREEN");
    expect(health.spi).toBe(1);
    expect(health.reasons).toEqual([]);
  });

  it("no sprints, risks, or milestones yet is NONE (No data yet) — unknown, not failing and not healthy", () => {
    const health = computeProjectHealth({ sprints: [], risks: [], milestones: [], today: TODAY });
    expect(health).toMatchObject({ rag: "NONE", spi: null, effortIndex: null, reasons: [] });
  });

  it("any one signal is enough to rate health — a logged low risk alone makes it GREEN", () => {
    const lowRisk = { ...highRisk, probability: "Low", impact: "Low" };
    expect(computeProjectHealth({ sprints: [], risks: [lowRisk], milestones: [], today: TODAY }).rag).toBe("GREEN");
    const future = { status: "NOT_STARTED", plannedDate: new Date("2099-01-01") };
    expect(computeProjectHealth({ sprints: [], risks: [], milestones: [future], today: TODAY }).rag).toBe("GREEN");
  });

  it("an open high-severity risk is RED", () => {
    const health = computeProjectHealth({ sprints: [], risks: [highRisk], milestones: [], today: TODAY });
    expect(health.rag).toBe("RED");
    expect(health.reasons).toEqual(["1 open high risk"]);
  });

  it("closed/mitigated risks, issues, and non-high scores don't count", () => {
    const health = computeProjectHealth({
      sprints: [],
      risks: [
        { ...highRisk, status: "Closed" },
        { ...highRisk, status: "Mitigated" },
        { ...highRisk, type: "Issue" },
        { ...highRisk, impact: "Medium" }, // 3 x 2 = 6 -> still high
        { ...highRisk, probability: "Low", impact: "Medium" }, // 1 x 2 = 2 -> not high
      ],
      milestones: [],
      today: TODAY,
    });
    expect(health.openHighRisks).toBe(1);
  });

  it("SPI under 0.9 is RED, 0.9–0.99 is AMBER", () => {
    const withSpi = (earned: number) =>
      computeProjectHealth({
        sprints: [sprint({ closedAt: new Date("2026-01-14"), frozenPlannedPoints: 100, frozenEarnedPoints: earned, frozenActualValue: 1 })],
        risks: [],
        milestones: [],
        today: TODAY,
      });
    expect(withSpi(85).rag).toBe("RED");
    expect(withSpi(95).rag).toBe("AMBER");
    expect(withSpi(100).rag).toBe("GREEN");
  });

  it("an overdue milestone is AMBER, and lists every reason most-severe first", () => {
    const amber = computeProjectHealth({
      sprints: [],
      risks: [],
      milestones: [{ status: "NOT_STARTED", plannedDate: new Date("2026-05-01") }],
      today: TODAY,
    });
    expect(amber.rag).toBe("AMBER");
    expect(amber.reasons).toEqual(["1 overdue milestone"]);

    const red = computeProjectHealth({
      sprints: [],
      risks: [highRisk, highRisk],
      milestones: [{ status: "NOT_STARTED", plannedDate: new Date("2026-05-01") }],
      today: TODAY,
    });
    expect(red.rag).toBe("RED");
    expect(red.reasons).toEqual(["2 open high risks", "1 overdue milestone"]);
  });
});
