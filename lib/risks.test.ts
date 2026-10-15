import { describe, it, expect } from "vitest";
import { isRiskOpen, isOpenHighThreat, summarizeRisks, sortRisks, dateClosedForStatus, summarizeCrs, crWarnings } from "./risks";

const risk = (o: Partial<{ type: string; status: string; probability: string; impact: string; dateRaised: Date | null }> = {}) => ({
  type: "Risk",
  status: "Open",
  probability: "High",
  impact: "High",
  dateRaised: null as Date | null,
  ...o,
});

describe("isRiskOpen", () => {
  it("Open, Monitoring and Realized are open; Mitigated, Closed and Not Pursued are closed", () => {
    for (const s of ["Open", "Monitoring", "Realized"]) expect(isRiskOpen(s)).toBe(true);
    for (const s of ["Mitigated", "Closed", "Not Pursued"]) expect(isRiskOpen(s)).toBe(false);
  });
});

describe("isOpenHighThreat", () => {
  it("counts open high Risks and Issues, never Opportunities", () => {
    expect(isOpenHighThreat(risk())).toBe(true);
    expect(isOpenHighThreat(risk({ type: "Issue" }))).toBe(true);
    expect(isOpenHighThreat(risk({ type: "Opportunity" }))).toBe(false);
  });

  it("ignores closed items and scores below 6", () => {
    expect(isOpenHighThreat(risk({ status: "Mitigated" }))).toBe(false);
    expect(isOpenHighThreat(risk({ status: "Not Pursued" }))).toBe(false);
    expect(isOpenHighThreat(risk({ status: "Realized" }))).toBe(true);
    expect(isOpenHighThreat(risk({ probability: "Medium", impact: "Medium" }))).toBe(false); // 4
    expect(isOpenHighThreat(risk({ probability: "Medium", impact: "High" }))).toBe(true); // 6
  });
});

describe("summarizeRisks", () => {
  it("buckets open threats by score, opportunities and closed separately", () => {
    const s = summarizeRisks([
      risk(),
      risk({ type: "Issue", probability: "Medium", impact: "High" }),
      risk({ probability: "Medium", impact: "Medium" }),
      risk({ probability: "Low", impact: "Low" }),
      risk({ type: "Opportunity" }),
      risk({ status: "Closed" }),
      risk({ type: "Opportunity", status: "Not Pursued" }),
    ]);
    expect(s).toEqual({ openHigh: 2, openMedium: 1, openLow: 1, openOpportunities: 1, closed: 2 });
  });
});

describe("sortRisks", () => {
  it("puts open before closed, then higher score, then most recently raised", () => {
    const a = risk({ status: "Closed" });
    const b = risk({ probability: "Low", impact: "Low" });
    const c = risk({ dateRaised: new Date("2026-01-01") });
    const d = risk({ dateRaised: new Date("2026-02-01") });
    expect(sortRisks([a, b, c, d])).toEqual([d, c, b, a]);
  });
});

describe("dateClosedForStatus", () => {
  const today = new Date("2026-10-15");
  it("stamps today when closing without a date, keeps an existing one", () => {
    expect(dateClosedForStatus("Closed", null, today)).toBe(today);
    expect(dateClosedForStatus("Mitigated", new Date("2026-10-01"), today)).toBeUndefined();
  });
  it("clears the date when reopening, leaves an open item without one alone", () => {
    expect(dateClosedForStatus("Open", new Date("2026-10-01"), today)).toBeNull();
    expect(dateClosedForStatus("Monitoring", null, today)).toBeUndefined();
  });
});

const cr = (o: Partial<{ type: string; status: string; manDaysPlanned: number | null; billableManDays: number | null; rate: number | null; clientSignoff: string; wbsUpdated: string }> = {}) => ({
  type: "Paid",
  status: "Approved",
  manDaysPlanned: 5,
  billableManDays: 4,
  rate: 200,
  clientSignoff: "Signed",
  wbsUpdated: "Yes",
  ...o,
});

describe("summarizeCrs", () => {
  it("counts paid value only for agreed Paid CRs — not Proposed, Rejected or Free", () => {
    const s = summarizeCrs([
      cr(), // 800
      cr({ status: "Completed" }), // 800
      cr({ status: "In Progress", billableManDays: 2 }), // 400
      cr({ status: "Proposed" }),
      cr({ status: "Rejected" }),
      cr({ type: "Free" }),
      cr({ type: "Exchange", status: "Completed" }),
    ]);
    expect(s.paidValue).toBe(2000);
    expect(s.proposed).toEqual({ count: 1, plannedManDays: 5 });
    expect(s.inWork).toEqual({ count: 3, billableManDays: 10 }); // Approved, In Progress, Free (Approved)
    expect(s.completed).toBe(2);
    expect(s.rejected).toBe(1);
  });
});

describe("crWarnings", () => {
  it("flags agreed CRs missing sign-off, WBS update, or an amount", () => {
    expect(crWarnings(cr())).toEqual([]);
    expect(crWarnings(cr({ clientSignoff: "Pending", wbsUpdated: "No", rate: null }))).toEqual([
      "No client sign-off yet",
      "WBS not updated",
      "No billable man-days or rate — amount unknown",
    ]);
  });
  it("says nothing for proposed or rejected CRs, and skips the rate check when rates are hidden", () => {
    expect(crWarnings(cr({ status: "Proposed", clientSignoff: "Pending" }))).toEqual([]);
    expect(crWarnings(cr({ status: "Rejected", wbsUpdated: "No" }))).toEqual([]);
    expect(crWarnings(cr({ rate: null }), true)).toEqual([]);
  });
});
