import { describe, it, expect } from "vitest";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_KEY, CHECKLIST_TYPE_BY_ROUTE } from "./checklist-types";
import { ALL_MODULES } from "./rbac-core";

describe("CHECKLIST_TYPES registry", () => {
  it("every entry's moduleName is a real RBAC module", () => {
    for (const c of CHECKLIST_TYPES) {
      expect(ALL_MODULES).toContain(c.moduleName);
    }
  });

  it("every entry's routeSegment round-trips through CHECKLIST_TYPE_BY_ROUTE", () => {
    for (const c of CHECKLIST_TYPES) {
      expect(CHECKLIST_TYPE_BY_ROUTE[c.routeSegment]).toBe(c);
    }
  });

  it("every entry's key round-trips through CHECKLIST_TYPE_BY_KEY", () => {
    for (const c of CHECKLIST_TYPES) {
      expect(CHECKLIST_TYPE_BY_KEY[c.key]).toBe(c);
    }
  });

  it("has a unique key, routeSegment, and moduleName per entry", () => {
    expect(new Set(CHECKLIST_TYPES.map((c) => c.key)).size).toBe(CHECKLIST_TYPES.length);
    expect(new Set(CHECKLIST_TYPES.map((c) => c.routeSegment)).size).toBe(CHECKLIST_TYPES.length);
    expect(new Set(CHECKLIST_TYPES.map((c) => c.moduleName)).size).toBe(CHECKLIST_TYPES.length);
  });

  it("every entry's stageOrder is non-empty with no duplicate stage names", () => {
    for (const c of CHECKLIST_TYPES) {
      expect(c.stageOrder.length).toBeGreaterThan(0);
      expect(new Set(c.stageOrder).size).toBe(c.stageOrder.length);
    }
  });
});
