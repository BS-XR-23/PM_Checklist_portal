import { describe, it, expect } from "vitest";
import {
  isPmPlanScalarField,
  cleanRowUpdate,
  stakeholderProgress,
  timelineProgress,
  gateProgress,
  commsProgress,
  deliverableProgress,
  resourceProgress,
} from "./pm-plan-rules";

describe("isPmPlanScalarField", () => {
  it("only plan text fields — never ids or timestamps", () => {
    expect(isPmPlanScalarField("rationale")).toBe(true);
    expect(isPmPlanScalarField("charterBudget")).toBe(true);
    for (const f of ["projectId", "id", "updatedAt", "__proto__"]) expect(isPmPlanScalarField(f)).toBe(false);
  });
});

describe("cleanRowUpdate", () => {
  it("passes allowed columns through", () => {
    expect(cleanRowUpdate("stakeholder", { role: "Sponsor", personId: "p1", influence: "High" })).toEqual({ role: "Sponsor", personId: "p1", influence: "High" });
    expect(cleanRowUpdate("comms", { personId: "" })).toEqual({ personId: null });
    expect(cleanRowUpdate("timeline", { start: "2026-09-01", end: "" })).toEqual({ start: "2026-09-01", end: "" });
  });

  it("refuses columns that would move the row or bypass the lists", () => {
    expect(() => cleanRowUpdate("stakeholder", { pmPlanId: "other-plan" })).toThrow();
    expect(() => cleanRowUpdate("gate", { id: "x" })).toThrow();
    expect(() => cleanRowUpdate("gate", { status: "Done" })).toThrow();
    expect(() => cleanRowUpdate("timeline", { status: "Approved" })).toThrow();
    expect(() => cleanRowUpdate("stakeholder", { influence: "Extreme" })).toThrow();
    expect(() => cleanRowUpdate("timeline", { start: "next week" })).toThrow();
    expect(() => cleanRowUpdate("raci", { pm: 5 })).toThrow();
  });
});

describe("section progress", () => {
  it("template stakeholder rows aren't a finished register", () => {
    const template = ["Sponsor", "Client / Product Owner", "Project Manager"].map((s) => ({ stakeholder: s, personId: null }));
    expect(stakeholderProgress(template)).toEqual({ status: "NOT_STARTED", label: "0/3 linked to a person" });
    expect(stakeholderProgress([{ stakeholder: "Client", personId: "p" }, { stakeholder: "QA", personId: null }]).status).toBe("IN_PROGRESS");
  });

  it("placeholder-named or undated phases don't count", () => {
    expect(timelineProgress([{ phase: "New phase", start: "2026-09-01", end: "2026-09-30" }]).status).toBe("NOT_STARTED");
    expect(timelineProgress([{ phase: "Discovery", start: "2026-09-01", end: "" }]).status).toBe("NOT_STARTED");
    expect(timelineProgress([{ phase: "Discovery", start: "2026-09-01", end: "2026-09-30" }]).status).toBe("COMPLETED");
  });

  it("gates progress by approvals, not by having rows", () => {
    expect(gateProgress(Array(7).fill({ status: "Not Started" }))).toEqual({ status: "NOT_STARTED", label: "0/7 approved" });
    expect(gateProgress([{ status: "Approved" }, { status: "In Progress" }])).toEqual({ status: "IN_PROGRESS", label: "1/2 approved" });
  });

  it("comms needs an escalation path and a row aimed at a person", () => {
    expect(commsProgress([{ personId: null }], null).status).toBe("NOT_STARTED");
    expect(commsProgress([{ personId: null }], "<p>Call the PM</p>").status).toBe("IN_PROGRESS");
    expect(commsProgress([{ personId: "p" }], "<p>Call the PM</p>").status).toBe("COMPLETED");
  });

  it("deliverables need evidence and a target; resources an allocation", () => {
    expect(deliverableProgress([{ deliverable: "APK", acceptanceEvidence: "", target: "Oct" }]).status).toBe("NOT_STARTED");
    expect(deliverableProgress([{ deliverable: "APK", acceptanceEvidence: "Signed UAT", target: "Oct" }]).status).toBe("COMPLETED");
    expect(resourceProgress([{ role: "New role", allocation: "1.0" }]).status).toBe("NOT_STARTED");
    expect(resourceProgress([{ role: "Lead Eng", allocation: "1.0 FTE" }]).status).toBe("COMPLETED");
  });
});
