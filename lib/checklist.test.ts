import { describe, it, expect } from "vitest";
import {
  checklistFlag,
  isChecklistItemOverdue,
  summarizeChecklist,
  checklistActualDateForStatus,
  lastDoneLabel,
  normalizeLink,
  safeHref,
} from "./checklist";

// Mid-afternoon on purpose: "due today" used to read as overdue once the
// clock passed midnight on the due date.
const TODAY = new Date("2026-10-15T15:00:00");
const d = (s: string) => new Date(`${s}T00:00:00`);
const item = (o: Partial<{ status: string; plannedDate: Date | null; actualDate: Date | null; isRecurring: boolean }> = {}) => ({
  status: "NOT_STARTED",
  plannedDate: null as Date | null,
  actualDate: null as Date | null,
  isRecurring: false,
  ...o,
});

describe("checklistFlag / isChecklistItemOverdue", () => {
  it("late, due today and due this week while open; nothing further out", () => {
    expect(checklistFlag(item({ plannedDate: d("2026-09-07") }), TODAY)).toEqual({ tone: "red", text: "38 days late" });
    expect(checklistFlag(item({ plannedDate: d("2026-10-14") }), TODAY)).toEqual({ tone: "red", text: "1 day late" });
    expect(checklistFlag(item({ plannedDate: d("2026-10-15") }), TODAY)).toEqual({ tone: "amber", text: "Due today" });
    expect(checklistFlag(item({ plannedDate: d("2026-10-22") }), TODAY)).toEqual({ tone: "amber", text: "Due in 7 days" });
    expect(checklistFlag(item({ plannedDate: d("2026-10-23") }), TODAY)).toBeNull();
    expect(isChecklistItemOverdue(item({ plannedDate: d("2026-10-15") }), TODAY)).toBe(false);
    expect(isChecklistItemOverdue(item({ status: "BLOCKED", plannedDate: d("2026-10-14") }), TODAY)).toBe(true);
  });

  it("done late shows how late; on-time, N/A, cadence and undated items show nothing", () => {
    expect(checklistFlag(item({ status: "COMPLETED", plannedDate: d("2026-09-01"), actualDate: d("2026-09-04") }), TODAY)).toEqual({ tone: "slate", text: "Done 3 days late" });
    expect(checklistFlag(item({ status: "COMPLETED", plannedDate: d("2026-09-01"), actualDate: d("2026-09-01") }), TODAY)).toBeNull();
    expect(checklistFlag(item({ status: "NOT_APPLICABLE", plannedDate: d("2026-09-01") }), TODAY)).toBeNull();
    expect(checklistFlag(item({ isRecurring: true, plannedDate: d("2026-09-01") }), TODAY)).toBeNull();
    expect(checklistFlag(item(), TODAY)).toBeNull();
  });
});

describe("summarizeChecklist", () => {
  it("counts only tracked items; overdue and due-this-week by date", () => {
    const s = summarizeChecklist(
      [
        item({ status: "COMPLETED", plannedDate: d("2026-09-01") }), // done, never overdue
        item({ status: "IN_PROGRESS", plannedDate: d("2026-10-01") }), // overdue
        item({ plannedDate: d("2026-10-15") }), // due today -> this week
        item({ plannedDate: d("2026-12-01") }),
        item({ status: "NOT_APPLICABLE", plannedDate: d("2026-09-01") }),
        item({ isRecurring: true, plannedDate: d("2026-09-01") }),
      ],
      TODAY
    );
    expect(s).toEqual({ applicable: 4, completed: 1, pct: 0.25, inProgress: 1, notStarted: 2, dueThisWeek: 1, overdue: 1 });
  });
});

describe("checklistActualDateForStatus", () => {
  it("completing fills today only when empty; reopening a completed item clears it", () => {
    expect(checklistActualDateForStatus("IN_PROGRESS", "COMPLETED", null, TODAY)).toBe(TODAY);
    expect(checklistActualDateForStatus("IN_PROGRESS", "COMPLETED", d("2026-10-01"), TODAY)).toBeUndefined();
    expect(checklistActualDateForStatus("COMPLETED", "IN_PROGRESS", d("2026-10-01"), TODAY)).toBeNull();
    expect(checklistActualDateForStatus("COMPLETED", "NOT_APPLICABLE", d("2026-10-01"), TODAY)).toBeUndefined();
    expect(checklistActualDateForStatus("NOT_STARTED", "IN_PROGRESS", d("2026-10-01"), TODAY)).toBeUndefined();
  });
});

describe("lastDoneLabel", () => {
  it("reads as days ago", () => {
    expect(lastDoneLabel(d("2026-10-15"), TODAY)).toBe("today");
    expect(lastDoneLabel(d("2026-10-14"), TODAY)).toBe("yesterday");
    expect(lastDoneLabel(d("2026-10-07"), TODAY)).toBe("8 days ago");
  });
});

describe("normalizeLink / safeHref", () => {
  it("adds https:// to bare addresses, keeps http(s), blanks become null", () => {
    expect(normalizeLink("drive.google.com/x")).toBe("https://drive.google.com/x");
    expect(normalizeLink("  https://github.com/a  ")).toBe("https://github.com/a");
    expect(normalizeLink("http://intranet/x")).toBe("http://intranet/x");
    expect(normalizeLink("   ")).toBeNull();
  });

  it("refuses links that could run code", () => {
    expect(() => normalizeLink("javascript:alert(1)")).toThrow();
    expect(() => normalizeLink("JavaScript:alert(1)")).toThrow();
    expect(() => normalizeLink("data:text/html,<script>1</script>")).toThrow();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("github.com/a")).toBe("https://github.com/a");
    expect(safeHref(null)).toBeNull();
  });
});
