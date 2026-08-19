import { describe, it, expect } from "vitest";
import { startOfMonthUTC, addMonthsUTC, parseMonthParam, toMonthParam, formatMonthLabel, formatMonthShortLabel, compareWbsNumbers } from "./format";

describe("startOfMonthUTC", () => {
  it("normalizes any day of the month to the 1st at UTC midnight", () => {
    expect(startOfMonthUTC(new Date("2026-07-19T13:45:00Z")).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("addMonthsUTC", () => {
  it("adds months, rolling over the year", () => {
    expect(addMonthsUTC(new Date("2026-11-01T00:00:00Z"), 2).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("subtracts months with a negative value", () => {
    expect(addMonthsUTC(new Date("2026-01-01T00:00:00Z"), -1).toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid yyyy-MM param", () => {
    expect(parseMonthParam("2026-07").toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("falls back to the current month when missing", () => {
    expect(parseMonthParam(undefined).toISOString()).toBe(startOfMonthUTC(new Date()).toISOString());
  });

  it("falls back to the current month when malformed", () => {
    expect(parseMonthParam("not-a-month").toISOString()).toBe(startOfMonthUTC(new Date()).toISOString());
    expect(parseMonthParam("2026-13").toISOString()).toBe(startOfMonthUTC(new Date()).toISOString());
  });

  it("takes the first value when Next.js hands it an array", () => {
    expect(parseMonthParam(["2026-07", "2026-08"]).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("toMonthParam", () => {
  it("formats a date as yyyy-MM", () => {
    expect(toMonthParam(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03");
  });
});

describe("formatMonthLabel", () => {
  it("formats a month as a readable label", () => {
    expect(formatMonthLabel(new Date("2026-07-01T00:00:00Z"))).toBe("July 2026");
  });
});

describe("formatMonthShortLabel", () => {
  it("formats a month as a compact 'Mon YY' label", () => {
    expect(formatMonthShortLabel(new Date("2026-07-01T00:00:00Z"))).toBe("Jul 26");
  });
});

describe("compareWbsNumbers", () => {
  it("sorts numerically within a segment, not lexically (2.10 after 2.9)", () => {
    const sorted = ["2.10", "2.2", "2.9", "10.1", "2.1"].sort(compareWbsNumbers);
    expect(sorted).toEqual(["2.1", "2.2", "2.9", "2.10", "10.1"]);
  });

  it("orders a shorter prefix before its children (1 before 1.1)", () => {
    expect(compareWbsNumbers("1", "1.1")).toBeLessThan(0);
  });

  it("sorts blank WBS# last, regardless of comparison order", () => {
    expect(compareWbsNumbers("", "1")).toBeGreaterThan(0);
    expect(compareWbsNumbers("1", "")).toBeLessThan(0);
    expect(compareWbsNumbers("", "")).toBe(0);
  });

  it("falls back to string comparison for non-numeric segments", () => {
    expect(compareWbsNumbers("1.a", "1.b")).toBeLessThan(0);
  });
});
