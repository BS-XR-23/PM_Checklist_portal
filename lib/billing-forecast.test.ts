import { describe, expect, it } from "vitest";
import { buildBillingForecast, type BillingProject } from "./billing-forecast";

const today = new Date("2026-10-14T09:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ms = (over: Partial<BillingProject["milestones"][number]> = {}): BillingProject["milestones"][number] => ({
  name: "M",
  status: "NOT_STARTED",
  plannedDate: null,
  forecastDate: null,
  payment: { paymentPct: 0.25, invoiceStatus: "Not Invoiced" },
  ...over,
});

describe("buildBillingForecast", () => {
  it("buckets un-invoiced tranches into ready / overdue / month / later / undated", () => {
    const f = buildBillingForecast(
      [
        {
          id: "p1",
          name: "P1",
          contractValue: 100_000,
          milestones: [
            ms({ name: "done", status: "COMPLETED", plannedDate: d("2026-09-01") }), // ready
            ms({ name: "late", plannedDate: d("2026-10-01") }), // overdue
            ms({ name: "nov", plannedDate: d("2026-11-20"), payment: { paymentPct: 0.1, invoiceStatus: "Not Invoiced" } }),
            ms({ name: "far", plannedDate: d("2027-09-01"), payment: { paymentPct: 0.1, invoiceStatus: "Not Invoiced" } }), // later
            ms({ name: "nodate", payment: { paymentPct: 0.15, invoiceStatus: "Not Invoiced" } }),
            ms({ name: "billed", plannedDate: d("2026-10-30"), payment: { paymentPct: 0.15, invoiceStatus: "Invoiced" } }),
          ],
        },
      ],
      today
    );
    expect(f.ready).toMatchObject({ amount: 25_000, items: [{ milestoneName: "done" }] });
    expect(f.overdue).toMatchObject({ amount: 25_000, items: [{ milestoneName: "late" }] });
    expect(f.months.map((m) => m.month)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
    expect(f.months[1]).toMatchObject({ amount: 10_000, items: [{ milestoneName: "nov" }] });
    expect(f.later.amount).toBe(10_000);
    expect(f.undated).toMatchObject({ amount: 15_000, items: [{ milestoneName: "nodate", due: null }] });
    // ready + overdue + Nov (within 90 days); far and undated aren't "due soon".
    expect(f.dueSoonAmount).toBe(60_000);
    expect(f.dueSoonCount).toBe(3);
    // 25+25+10+10+15+15 = 100% allocated
    expect(f.unallocated.amount).toBeCloseTo(0);
  });

  it("uses the forecast date when re-forecast, and skips N/A or zero-% milestones", () => {
    const f = buildBillingForecast(
      [
        {
          id: "p1",
          name: "P1",
          contractValue: 1_000,
          milestones: [
            ms({ plannedDate: d("2026-10-01"), forecastDate: d("2026-12-05") }), // not overdue — re-forecast to Dec
            ms({ status: "NOT_APPLICABLE", plannedDate: d("2026-10-01") }),
            ms({ plannedDate: d("2026-10-20"), payment: { paymentPct: 0, invoiceStatus: "Not Invoiced" } }),
          ],
        },
      ],
      today
    );
    expect(f.overdue.amount).toBe(0);
    expect(f.months.find((m) => m.month === "2026-12")?.amount).toBe(250);
    expect(f.months.reduce((s, m) => s + m.items.length, 0)).toBe(1);
  });

  it("reports contract value not tied to any milestone payment", () => {
    const f = buildBillingForecast(
      [
        { id: "a", name: "A", contractValue: 89_500, milestones: [ms({ status: "COMPLETED", payment: { paymentPct: 0.2, invoiceStatus: "Paid" } })] },
        { id: "b", name: "B", contractValue: 48_500, milestones: [] },
        { id: "c", name: "C", contractValue: 0, milestones: [] }, // no contract value — nothing to allocate
      ],
      today
    );
    expect(f.unallocated.projects.map((p) => [p.projectName, Math.round(p.pct * 100)])).toEqual([
      ["A", 80],
      ["B", 100],
    ]);
    expect(f.unallocated.amount).toBeCloseTo(89_500 * 0.8 + 48_500);
  });
});
