import { describe, it, expect } from "vitest";
import { buildQmsReport, canViewQms, combineQmsStatuses, missingQmsEvidence, qmsItemStatus, qmsSheetRows, type QmsCr, type QmsItem } from "./qms";
import { QMS_CRITERIA, QMS_CR_CRITERIA, QMS_STAGES, QMS_TOPICS } from "./qms-criteria";
import { CREATIVE_XR_CHECKLIST_SEED, DELIVERY_QA_CHECKLIST_SEED, DEV_CHECKLIST_SEED, DEVOPS_CHECKLIST_SEED, PM_CHECKLIST_SEED } from "./seed-data";

const DATE = new Date("2026-11-01T00:00:00Z");

const item = (over: Partial<QmsItem> = {}): QmsItem => ({
  id: "i1",
  type: "PM",
  itemText: "An item",
  status: "NOT_STARTED",
  isRecurring: false,
  link: null,
  actualDate: null,
  ownerName: null,
  notes: null,
  qmsRefs: ["Q1"],
  occurrences: [],
  ...over,
});
const complete = (over: Partial<QmsItem> = {}) => item({ status: "COMPLETED", ownerName: "Ana", actualDate: DATE, link: "https://x.test/doc", ...over });
const cr = (over: Partial<QmsCr> = {}): QmsCr => ({ crCode: "CR-001", title: "A change", status: "Approved", clientSignoff: "Signed", wbsUpdated: "Yes", documentLink: "https://x.test/cr", ...over });

describe("the QMS sheet", () => {
  it("has the sheet's 14 topics, 45 criteria and 70 process steps", () => {
    expect(QMS_TOPICS).toHaveLength(14);
    expect(QMS_CRITERIA).toHaveLength(45);
    expect(QMS_TOPICS.flatMap((t) => t.rows).filter((r) => r.step)).toHaveLength(70);
    expect(QMS_STAGES).toEqual(["Planning", "Development", "Closing and Maintenance"]);
  });

  it("numbers the criteria Q1-Q45 in sheet order", () => {
    expect(QMS_CRITERIA.map((c) => c.id)).toEqual(Array.from({ length: 45 }, (_, i) => `Q${i + 1}`));
  });

  it("the template answers every criterion the CR log doesn't, with real IDs", () => {
    const refs = [PM_CHECKLIST_SEED, DELIVERY_QA_CHECKLIST_SEED, DEVOPS_CHECKLIST_SEED, CREATIVE_XR_CHECKLIST_SEED, DEV_CHECKLIST_SEED].flat().flatMap((i) => i.qmsRefs ?? []);
    const crIds: string[] = [QMS_CR_CRITERIA.document, QMS_CR_CRITERIA.backlog];
    for (const c of QMS_CRITERIA) expect(refs.includes(c.id)).toBe(!crIds.includes(c.id));
    for (const r of refs) expect(QMS_CRITERIA.some((c) => c.id === r)).toBe(true);
  });
});

describe("qmsItemStatus: one-time items", () => {
  it("follows the item while it isn't finished", () => {
    expect(qmsItemStatus(item())).toBe("NOT_STARTED");
    for (const status of ["IN_PROGRESS", "AT_RISK", "DELAYED", "BLOCKED"]) expect(qmsItemStatus(item({ status }))).toBe("IN_PROGRESS");
  });

  it("is Done only when completed with owner, actual date and link", () => {
    expect(qmsItemStatus(complete())).toBe("DONE");
    expect(qmsItemStatus(complete({ ownerName: null }))).toBe("EVIDENCE_MISSING");
    expect(qmsItemStatus(complete({ actualDate: null }))).toBe("EVIDENCE_MISSING");
    expect(qmsItemStatus(complete({ link: null }))).toBe("EVIDENCE_MISSING");
  });

  it("doesn't accept an unsafe link as evidence", () => {
    expect(qmsItemStatus(complete({ link: "javascript:alert(1)" }))).toBe("EVIDENCE_MISSING");
  });

  it("names exactly what's missing", () => {
    expect(missingQmsEvidence(complete({ link: null, ownerName: "  " }))).toEqual(["owner", "link"]);
    expect(missingQmsEvidence(complete())).toEqual([]);
  });

  it("needs a reason before N/A counts", () => {
    expect(qmsItemStatus(item({ status: "NOT_APPLICABLE", notes: "No app store release" }))).toBe("NOT_APPLICABLE");
    expect(qmsItemStatus(item({ status: "NOT_APPLICABLE", notes: "  " }))).toBe("EVIDENCE_MISSING");
  });
});

describe("qmsItemStatus: recurring items", () => {
  it("is Not started until the first log, then Done, with no time limit", () => {
    expect(qmsItemStatus(item({ isRecurring: true }))).toBe("NOT_STARTED");
    expect(qmsItemStatus(item({ isRecurring: true, occurrences: [{ date: new Date("2020-01-01"), link: "https://x.test/a" }] }))).toBe("DONE");
  });

  it("ignores the old Last done date and the item's status", () => {
    expect(qmsItemStatus(item({ isRecurring: true, actualDate: DATE, status: "COMPLETED", link: "https://x.test" }))).toBe("NOT_STARTED");
  });
});

describe("combineQmsStatuses", () => {
  it("reports Not linked when nothing answers a criterion", () => {
    expect(combineQmsStatuses([])).toBe("NOT_LINKED");
  });

  it("needs every applicable source done", () => {
    expect(combineQmsStatuses(["DONE", "DONE"])).toBe("DONE");
    expect(combineQmsStatuses(["DONE", "NOT_APPLICABLE"])).toBe("DONE");
    expect(combineQmsStatuses(["DONE", "NOT_STARTED"])).toBe("IN_PROGRESS");
    expect(combineQmsStatuses(["DONE", "EVIDENCE_MISSING"])).toBe("EVIDENCE_MISSING");
    expect(combineQmsStatuses(["EVIDENCE_MISSING", "NOT_STARTED"])).toBe("IN_PROGRESS");
    expect(combineQmsStatuses(["NOT_STARTED", "NOT_APPLICABLE"])).toBe("NOT_STARTED");
    expect(combineQmsStatuses(["NOT_APPLICABLE", "NOT_APPLICABLE"])).toBe("NOT_APPLICABLE");
  });
});

describe("buildQmsReport", () => {
  it("gives one item's result to every criterion it answers", () => {
    const { byId } = buildQmsReport([complete({ qmsRefs: ["Q9", "Q10", "Q11"] })], []);
    expect([byId.Q9.status, byId.Q10.status, byId.Q11.status]).toEqual(["DONE", "DONE", "DONE"]);
  });

  it("Q45 waits for KT, technical documents and handover together", () => {
    const two = [complete({ id: "a", qmsRefs: ["Q45"] }), complete({ id: "b", type: "DEV", qmsRefs: ["Q45"] })];
    const third = item({ id: "c", type: "DEV", qmsRefs: ["Q45"] });
    expect(buildQmsReport([...two, third], []).byId.Q45.status).toBe("IN_PROGRESS");
    expect(buildQmsReport([...two, complete({ id: "c", type: "DEV", qmsRefs: ["Q45"] })], []).byId.Q45.status).toBe("DONE");
  });

  it("shows a criterion with no item as Not linked, never as complete", () => {
    const { byId, summary } = buildQmsReport([], []);
    expect(byId.Q1.status).toBe("NOT_LINKED");
    expect(summary.done).toBe(0);
  });

  it("marks the CR criteria N/A when no CR has been agreed", () => {
    for (const crs of [[], [cr({ status: "Proposed" })], [cr({ status: "Rejected" })]]) {
      const { byId } = buildQmsReport([], crs);
      expect([byId.Q33.status, byId.Q34.status]).toEqual(["NOT_APPLICABLE", "NOT_APPLICABLE"]);
    }
  });

  it("needs sign-off and a document for Q33, and WBS Updated for Q34", () => {
    expect(buildQmsReport([], [cr()]).byId.Q33.status).toBe("DONE");
    expect(buildQmsReport([], [cr({ documentLink: null })]).byId.Q33.status).toBe("EVIDENCE_MISSING");
    expect(buildQmsReport([], [cr({ clientSignoff: "Pending" })]).byId.Q33.status).toBe("IN_PROGRESS");
    expect(buildQmsReport([], [cr(), cr({ crCode: "CR-002", documentLink: null })]).byId.Q33.status).toBe("EVIDENCE_MISSING");
    expect(buildQmsReport([], [cr()]).byId.Q34.status).toBe("DONE");
    expect(buildQmsReport([], [cr({ wbsUpdated: "No" })]).byId.Q34.status).toBe("IN_PROGRESS");
  });

  it("leaves N/A out of the percentage", () => {
    const { summary } = buildQmsReport([complete({ qmsRefs: ["Q1"] })], []);
    expect(summary.notApplicable).toBe(2);
    expect(summary.total).toBe(43);
    expect(summary.done).toBe(1);
    expect(summary.pct).toBeCloseTo(1 / 43);
  });

  it("lists a recurring item's logs newest first", () => {
    const logs = [
      { date: new Date("2026-10-01"), link: "https://x.test/old" },
      { date: new Date("2026-11-01"), link: "https://x.test/new" },
    ];
    const source = buildQmsReport([item({ isRecurring: true, occurrences: logs })], []).byId.Q1.sources[0];
    expect(source.logCount).toBe(2);
    expect(source.date).toEqual(logs[1].date);
    expect(source.links.map((l) => l.href)).toEqual(["https://x.test/new", "https://x.test/old"]);
  });
});

describe("qmsSheetRows", () => {
  const rows = qmsSheetRows(buildQmsReport([complete({ qmsRefs: ["Q1"], link: "https://x.test/teams" })], []), () => "1 Nov");

  it("keeps the sheet's columns and shows each stage and topic once", () => {
    expect(Object.keys(rows[0])).toEqual(["Stage", "Topic", "Details", "Acceptance Criteria", "Status", "Evidence Link", "Comments"]);
    expect(rows.filter((r) => r.Stage).map((r) => r.Stage)).toEqual(QMS_STAGES);
    expect(rows.filter((r) => r.Topic)).toHaveLength(14);
    expect(rows.filter((r) => r["Acceptance Criteria"])).toHaveLength(45);
  });

  it("fills status, link and comment from the work", () => {
    expect(rows[0].Status).toBe("Done");
    expect(rows[0]["Evidence Link"]).toBe("https://x.test/teams");
    expect(rows[0].Comments).toContain("Ana");
  });
});

describe("canViewQms", () => {
  it("is for the delivery organisation, not Client or Limited", () => {
    expect((["ADMIN", "TPM", "PROGRAM_MANAGER", "PM"] as const).every(canViewQms)).toBe(true);
    expect((["CLIENT", "LIMITED"] as const).some(canViewQms)).toBe(false);
  });
});
