import { describe, it, expect } from "vitest";
import { isCurrentlyActive } from "./overload";

const TODAY = new Date("2026-07-24T00:00:00Z");

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

  it("the end date itself still counts as active (inclusive)", () => {
    expect(isCurrentlyActive({ startDate: null, endDate: new Date("2026-07-24T00:00:00Z") }, new Date("2026-07-24T15:00:00Z"))).toBe(true);
    expect(isCurrentlyActive({ startDate: null, endDate: new Date("2026-07-23T00:00:00Z") }, new Date("2026-07-24T15:00:00Z"))).toBe(false);
  });
});
