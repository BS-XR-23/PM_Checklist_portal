import { describe, it, expect } from "vitest";
import {
  meetsLevel,
  computeProjectAccess,
  computeModuleAccess,
  DEFAULT_CLIENT_PERMISSIONS,
  DEFAULT_LIMITED_PERMISSIONS,
  ACCESS_PRESETS,
  ALL_MODULES,
  type MembershipLike,
} from "./rbac-core";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";

function membership(role: Role, permissions: { module: ModuleName; access: AccessLevel }[] = []): MembershipLike {
  return { role, permissions };
}

describe("meetsLevel", () => {
  it("orders NONE < READ_LIMITED < READ_FULL < WRITE", () => {
    expect(meetsLevel("NONE", "NONE")).toBe(true);
    expect(meetsLevel("NONE", "READ_LIMITED")).toBe(false);
    expect(meetsLevel("READ_LIMITED", "NONE")).toBe(true);
    expect(meetsLevel("READ_FULL", "READ_LIMITED")).toBe(true);
    expect(meetsLevel("READ_FULL", "WRITE")).toBe(false);
    expect(meetsLevel("WRITE", "WRITE")).toBe(true);
  });
});

describe("computeProjectAccess (coarse gate)", () => {
  it("ADMIN, TPM, and PROGRAM_MANAGER always pass, regardless of membership", () => {
    expect(computeProjectAccess("ADMIN", null)).toBe(true);
    expect(computeProjectAccess("TPM", null)).toBe(true);
    expect(computeProjectAccess("PROGRAM_MANAGER", null)).toBe(true);
  });

  it("PROGRAM_MANAGER (Management) drills into every project read-only, same blanket rule as TPM", () => {
    expect(computeProjectAccess("PROGRAM_MANAGER", null)).toBe(true);
    expect(computeProjectAccess("PROGRAM_MANAGER", membership("PM"))).toBe(true);
  });

  it("PM / CLIENT / LIMITED require an explicit membership row", () => {
    expect(computeProjectAccess("PM", null)).toBe(false);
    expect(computeProjectAccess("PM", membership("PM"))).toBe(true);
    expect(computeProjectAccess("CLIENT", null)).toBe(false);
    expect(computeProjectAccess("CLIENT", membership("CLIENT"))).toBe(true);
    expect(computeProjectAccess("LIMITED", null)).toBe(false);
    expect(computeProjectAccess("LIMITED", membership("LIMITED"))).toBe(true);
  });
});

describe("computeModuleAccess — role x module matrix", () => {
  it("ADMIN gets WRITE on every module, with or without a membership row", () => {
    for (const m of ALL_MODULES) {
      expect(computeModuleAccess("ADMIN", null, m)).toBe("WRITE");
      expect(computeModuleAccess("ADMIN", membership("PM"), m)).toBe("WRITE");
    }
  });

  it("TPM gets READ_FULL on every module except Budget Tracker (Admin-only), never WRITE through the normal path", () => {
    for (const m of ALL_MODULES) {
      if (m === "BUDGET_TRACKER") continue;
      expect(computeModuleAccess("TPM", null, m)).toBe("READ_FULL");
    }
    expect(computeModuleAccess("TPM", null, "BUDGET_TRACKER")).toBe("NONE");
  });

  it("PROGRAM_MANAGER gets READ_FULL on every module except Decision Log, Action Items, and Budget Tracker", () => {
    const excluded: ModuleName[] = ["DECISION_LOG", "ACTION_ITEMS", "BUDGET_TRACKER"];
    for (const m of ALL_MODULES) {
      const expected = excluded.includes(m) ? "NONE" : "READ_FULL";
      expect(computeModuleAccess("PROGRAM_MANAGER", null, m)).toBe(expected);
      // Membership is irrelevant — same blanket rule regardless.
      expect(computeModuleAccess("PROGRAM_MANAGER", membership("PM"), m)).toBe(expected);
    }
  });

  it("PM gets WRITE on every module of their assigned project except Budget Tracker (Admin-only), NONE without membership", () => {
    for (const m of ALL_MODULES) {
      if (m === "BUDGET_TRACKER") continue;
      expect(computeModuleAccess("PM", membership("PM"), m)).toBe("WRITE");
      expect(computeModuleAccess("PM", null, m)).toBe("NONE");
    }
    expect(computeModuleAccess("PM", membership("PM"), "BUDGET_TRACKER")).toBe("NONE");
  });

  it("Budget Tracker is Admin-only regardless of role, membership, or per-user permission overrides", () => {
    expect(computeModuleAccess("ADMIN", null, "BUDGET_TRACKER")).toBe("WRITE");
    expect(computeModuleAccess("TPM", null, "BUDGET_TRACKER")).toBe("NONE");
    expect(computeModuleAccess("PM", membership("PM"), "BUDGET_TRACKER")).toBe("NONE");
    // Even an explicit CLIENT permission override granting WRITE can't get through the special-case.
    const mem = membership("CLIENT", [{ module: "BUDGET_TRACKER", access: "WRITE" }]);
    expect(computeModuleAccess("CLIENT", mem, "BUDGET_TRACKER")).toBe("NONE");
  });

  it("CLIENT/LIMITED get NONE for any module with no explicit permission row (secure by default)", () => {
    expect(computeModuleAccess("CLIENT", membership("CLIENT", []), "MILESTONES")).toBe("NONE");
    expect(computeModuleAccess("LIMITED", membership("LIMITED", []), "PM_CHECKLIST")).toBe("NONE");
  });

  it("CLIENT/LIMITED get exactly what their ModulePermission rows grant", () => {
    const mem = membership("CLIENT", [
      { module: "MILESTONES", access: "READ_FULL" },
      { module: "RISK_REGISTER", access: "NONE" },
    ]);
    expect(computeModuleAccess("CLIENT", mem, "MILESTONES")).toBe("READ_FULL");
    expect(computeModuleAccess("CLIENT", mem, "RISK_REGISTER")).toBe("NONE");
    expect(computeModuleAccess("CLIENT", mem, "CR_LOG")).toBe("NONE"); // no row at all -> NONE
  });

  it("a global CLIENT/LIMITED/PM role with no membership on THIS project is NONE everywhere (isolation)", () => {
    // This is the crux of the Project-A-vs-Project-B isolation guarantee:
    // holding a role globally means nothing without a membership row for
    // this specific project.
    for (const role of ["PM", "CLIENT", "LIMITED"] as Role[]) {
      for (const m of ALL_MODULES) {
        expect(computeModuleAccess(role, null, m)).toBe("NONE");
      }
    }
  });
});

describe("DEFAULT_CLIENT_PERMISSIONS", () => {
  it("locks down Risk Register, CR Log, Budget Tracker, and PM Plan by default", () => {
    const byModule = Object.fromEntries(DEFAULT_CLIENT_PERMISSIONS.map((p) => [p.module, p.access]));
    expect(byModule.RISK_REGISTER).toBe("NONE");
    expect(byModule.CR_LOG).toBe("NONE");
    expect(byModule.BUDGET_TRACKER).toBe("NONE");
    expect(byModule.PM_PLAN).toBe("NONE");
  });

  it("exposes milestones/payment status in full, and checklist/dashboard progress in limited form", () => {
    const byModule = Object.fromEntries(DEFAULT_CLIENT_PERMISSIONS.map((p) => [p.module, p.access]));
    expect(byModule.MILESTONES).toBe("READ_FULL");
    expect(byModule.PM_CHECKLIST).toBe("READ_LIMITED");
    expect(byModule.DEVOPS_CHECKLIST).toBe("READ_LIMITED");
    expect(byModule.DASHBOARD).toBe("READ_LIMITED");
  });

  it("covers every module exactly once", () => {
    const modules = DEFAULT_CLIENT_PERMISSIONS.map((p) => p.module).sort();
    expect(modules).toEqual([...ALL_MODULES].sort());
  });
});

describe("DEFAULT_LIMITED_PERMISSIONS", () => {
  it("grants READ_LIMITED on every module except Budget Tracker (Admin-only regardless)", () => {
    const byModule = Object.fromEntries(DEFAULT_LIMITED_PERMISSIONS.map((p) => [p.module, p.access]));
    for (const m of ALL_MODULES) {
      expect(byModule[m]).toBe(m === "BUDGET_TRACKER" ? "NONE" : "READ_LIMITED");
    }
  });

  it("covers every module exactly once", () => {
    const modules = DEFAULT_LIMITED_PERMISSIONS.map((p) => p.module).sort();
    expect(modules).toEqual([...ALL_MODULES].sort());
  });
});

describe("ACCESS_PRESETS", () => {
  it("has a unique key per preset, each covering every module exactly once", () => {
    const keys = ACCESS_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const preset of ACCESS_PRESETS) {
      const modules = preset.permissions.map((p) => p.module).sort();
      expect(modules).toEqual([...ALL_MODULES].sort());
    }
  });

  it("never sets BUDGET_TRACKER to anything but NONE — it's Admin-only regardless of what's stored", () => {
    for (const preset of ACCESS_PRESETS) {
      const budget = preset.permissions.find((p) => p.module === "BUDGET_TRACKER");
      expect(budget?.access).toBe("NONE");
    }
  });

  it("'full-visibility' grants READ_FULL everywhere except Budget Tracker", () => {
    const preset = ACCESS_PRESETS.find((p) => p.key === "full-visibility")!;
    for (const p of preset.permissions) {
      expect(p.access).toBe(p.module === "BUDGET_TRACKER" ? "NONE" : "READ_FULL");
    }
  });

  it("'no-access' clears every module to NONE", () => {
    const preset = ACCESS_PRESETS.find((p) => p.key === "no-access")!;
    for (const p of preset.permissions) {
      expect(p.access).toBe("NONE");
    }
  });
});
