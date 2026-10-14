import { describe, it, expect } from "vitest";
import { summarizeMilestones, milestoneDueDate, type MilestoneLike } from "./milestones";

const TODAY = new Date("2026-06-15T10:00:00Z");

function ms(overrides: Partial<MilestoneLike> = {}): MilestoneLike {
  return {
    id: "m",
    name: "Milestone",
    status: "NOT_STARTED",
    plannedDate: null,
    forecastDate: null,
    actualDate: null,
    payment: null,
    ...overrides,
  };
}

describe("milestoneDueDate", () => {
  it("prefers the forecast over the plan", () => {
    expect(milestoneDueDate({ plannedDate: new Date("2026-06-01"), forecastDate: new Date("2026-07-01") })).toEqual(new Date("2026-07-01"));
    expect(milestoneDueDate({ plannedDate: new Date("2026-06-01"), forecastDate: null })).toEqual(new Date("2026-06-01"));
  });
});

describe("summarizeMilestones", () => {
  it("never reports an overdue milestone as 'next' — overdue ones are listed separately", () => {
    const s = summarizeMilestones(
      [
        ms({ name: "DoR Approved", plannedDate: new Date("2026-06-01") }), // overdue
        ms({ name: "MVP", plannedDate: new Date("2026-07-01") }),
        ms({ name: "Done already", status: "COMPLETED", plannedDate: new Date("2026-05-01") }),
      ],
      100000,
      TODAY
    );
    expect(s.nextMilestone?.name).toBe("MVP");
    expect(s.overdue.map((o) => o.name)).toEqual(["DoR Approved"]);
  });

  it("a milestone due today is next, not overdue", () => {
    const s = summarizeMilestones([ms({ name: "Today", plannedDate: new Date("2026-06-15T00:00:00Z") })], 0, TODAY);
    expect(s.nextMilestone?.name).toBe("Today");
    expect(s.overdue).toEqual([]);
  });

  it("planned end is the latest milestone date (actual if done, else due), ignoring N/A", () => {
    const s = summarizeMilestones(
      [
        ms({ status: "COMPLETED", plannedDate: new Date("2026-03-01"), actualDate: new Date("2026-03-10") }),
        ms({ plannedDate: new Date("2026-08-01"), forecastDate: new Date("2026-09-01") }),
        ms({ status: "NOT_APPLICABLE", plannedDate: new Date("2027-01-01") }),
      ],
      0,
      TODAY
    );
    expect(s.plannedEnd).toEqual(new Date("2026-09-01"));
  });

  it("next payment skips 0% and already-invoiced tranches, and picks the earliest due", () => {
    const s = summarizeMilestones(
      [
        ms({ name: "Zero tranche", plannedDate: new Date("2026-01-01"), payment: { paymentPct: 0, invoiceStatus: "Not Invoiced" } }),
        ms({ name: "Billed", plannedDate: new Date("2026-02-01"), payment: { paymentPct: 0.2, invoiceStatus: "Invoiced" } }),
        ms({ name: "Later", plannedDate: new Date("2026-09-01"), payment: { paymentPct: 0.4, invoiceStatus: "Not Invoiced" } }),
        ms({ name: "Sooner", plannedDate: new Date("2026-07-01"), payment: { paymentPct: 0.3, invoiceStatus: "Not Invoiced" } }),
      ],
      100000,
      TODAY
    );
    expect(s.nextPayment).toEqual({ name: "Sooner", date: new Date("2026-07-01"), amount: 30000 });
  });

  it("totals paid, invoiced, and allocated payment % across milestones", () => {
    const s = summarizeMilestones(
      [
        ms({ payment: { paymentPct: 0.2, invoiceStatus: "Paid" } }),
        ms({ payment: { paymentPct: 0.3, invoiceStatus: "Invoiced" } }),
        ms({ payment: { paymentPct: 0.5, invoiceStatus: "Not Invoiced" } }),
        ms({ payment: null }),
      ],
      89500,
      TODAY
    );
    expect(s.paidAmount).toBeCloseTo(17900);
    expect(s.invoicedAmount).toBeCloseTo(26850);
    expect(s.totalAllocatedPct).toBeCloseTo(1);
  });
});
