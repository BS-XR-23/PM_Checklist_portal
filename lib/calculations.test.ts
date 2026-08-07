import { describe, it, expect } from "vitest";
import { currentStage, isSlipped, reminderBand, checklistCompletionPct, sumRoleCosts } from "./calculations";

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
  const forecastPastDue = new Date("2026-02-01");

  it("flags a forecast date that's slipped past the planned date on an incomplete item", () => {
    expect(isSlipped(planned, forecastPastDue, "IN_PROGRESS")).toBe(true);
  });

  it("never flags a COMPLETED item, even if the forecast slipped", () => {
    expect(isSlipped(planned, forecastPastDue, "COMPLETED")).toBe(false);
  });

  it("never flags a NOT_APPLICABLE item, even if the forecast slipped", () => {
    expect(isSlipped(planned, forecastPastDue, "NOT_APPLICABLE")).toBe(false);
  });

  it("no flag when either date is missing", () => {
    expect(isSlipped(null, forecastPastDue, "IN_PROGRESS")).toBe(false);
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

describe("sumRoleCosts", () => {
  it("sums man-days x rate across rows", () => {
    const rows = [
      { manDays: 3.5, manDayRate: 200 },
      { manDays: 2, manDayRate: 350 },
    ];
    expect(sumRoleCosts(rows)).toBe(3.5 * 200 + 2 * 350);
  });

  it("returns 0 for an empty breakdown", () => {
    expect(sumRoleCosts([])).toBe(0);
  });
});
