import { describe, it, expect } from "vitest";
import { currentStage, isSlipped } from "./calculations";

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
