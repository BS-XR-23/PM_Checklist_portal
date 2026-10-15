import { describe, it, expect } from "vitest";
import {
  dependencyDaysLeft,
  isDependencyOverdue,
  isUrgentDependency,
  countOverdueUrgentDependencies,
  sortDependencies,
  summarizeOverdueDependencies,
} from "./dependencies";

const TODAY = new Date("2026-10-15T14:00:00");
const dep = (o: Partial<{ status: string; priority: string; expectedDate: Date | null; responsible: string | null; id: string }> = {}) => ({
  status: "Due",
  priority: "Medium",
  expectedDate: null as Date | null,
  responsible: null as string | null,
  id: "",
  ...o,
});

describe("dependencyDaysLeft / isDependencyOverdue", () => {
  it("counts whole days to the expected date; negative means overdue", () => {
    expect(dependencyDaysLeft(dep({ expectedDate: new Date("2026-10-20T00:00:00") }), TODAY)).toBe(5);
    expect(dependencyDaysLeft(dep({ expectedDate: new Date("2026-10-15T00:00:00") }), TODAY)).toBe(0);
    expect(dependencyDaysLeft(dep({ expectedDate: new Date("2026-09-10T00:00:00") }), TODAY)).toBe(-35);
    expect(isDependencyOverdue(dep({ expectedDate: new Date("2026-10-15T00:00:00") }), TODAY)).toBe(false); // due today isn't late yet
    expect(isDependencyOverdue(dep({ expectedDate: new Date("2026-10-14T00:00:00") }), TODAY)).toBe(true);
  });

  it("received or undated items are never overdue; blocked ones can be", () => {
    expect(dependencyDaysLeft(dep({ status: "Done", expectedDate: new Date("2026-09-10") }), TODAY)).toBeNull();
    expect(dependencyDaysLeft(dep(), TODAY)).toBeNull();
    expect(isDependencyOverdue(dep({ status: "Blocked", expectedDate: new Date("2026-09-10") }), TODAY)).toBe(true);
  });
});

describe("urgent overdue count", () => {
  it("only High/Extreme overdue items count", () => {
    expect(isUrgentDependency({ priority: "Extreme" })).toBe(true);
    expect(isUrgentDependency({ priority: "Medium" })).toBe(false);
    const late = new Date("2026-09-10T00:00:00");
    expect(
      countOverdueUrgentDependencies(
        [dep({ priority: "High", expectedDate: late }), dep({ priority: "Extreme", expectedDate: late }), dep({ priority: "Medium", expectedDate: late }), dep({ priority: "High" })],
        TODAY
      )
    ).toBe(2);
  });
});

describe("sortDependencies", () => {
  it("overdue first, then priority, then date; received last", () => {
    const a = dep({ id: "a", priority: "Medium", expectedDate: new Date("2026-09-10") });
    const b = dep({ id: "b", priority: "Extreme", expectedDate: new Date("2026-09-12") });
    const c = dep({ id: "c", priority: "Extreme", expectedDate: new Date("2026-11-01") });
    const d = dep({ id: "d", status: "Done", priority: "Extreme", expectedDate: new Date("2026-09-01") });
    const e = dep({ id: "e", priority: "Low" });
    expect(sortDependencies([d, e, c, a, b], TODAY).map((x) => x.id)).toEqual(["b", "a", "c", "e", "d"]);
  });
});

describe("summarizeOverdueDependencies", () => {
  it("counts overdue items, the oldest, the urgent ones and who they're from", () => {
    const s = summarizeOverdueDependencies(
      [
        dep({ priority: "High", expectedDate: new Date("2026-09-10T00:00:00"), responsible: "DED" }),
        dep({ priority: "Medium", expectedDate: new Date("2026-10-01T00:00:00"), responsible: " DED " }),
        dep({ priority: "Extreme", expectedDate: new Date("2026-10-30T00:00:00"), responsible: "Vendor" }),
      ],
      TODAY
    );
    expect(s).toEqual({ count: 2, oldestDays: 35, urgent: 1, from: ["DED"] });
  });
});
