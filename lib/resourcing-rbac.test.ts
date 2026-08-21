import { describe, it, expect } from "vitest";
import {
  canViewResourcing,
  canManagePersonRegistry,
  canViewPersonRegistry,
  canManageEngagementsOnProject,
  canViewPortfolioOverload,
} from "./resourcing-rbac";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

describe("canViewResourcing", () => {
  it("ADMIN, TPM, PROGRAM_MANAGER, PM can view; CLIENT, LIMITED cannot", () => {
    const expected: Record<Role, boolean> = {
      ADMIN: true,
      TPM: true,
      PM: true,
      PROGRAM_MANAGER: true,
      CLIENT: false,
      LIMITED: false,
    };
    for (const role of ALL_ROLES) expect(canViewResourcing(role)).toBe(expected[role]);
  });
});

describe("canManagePersonRegistry", () => {
  it("only ADMIN can edit the canonical Person registry (rates, competencies, records)", () => {
    for (const role of ALL_ROLES) expect(canManagePersonRegistry(role)).toBe(role === "ADMIN");
  });
});

describe("canViewPersonRegistry", () => {
  it("ADMIN, TPM, PROGRAM_MANAGER, PM can view read-only; CLIENT, LIMITED cannot", () => {
    const expected: Record<Role, boolean> = {
      ADMIN: true,
      TPM: true,
      PROGRAM_MANAGER: true,
      PM: true,
      CLIENT: false,
      LIMITED: false,
    };
    for (const role of ALL_ROLES) expect(canViewPersonRegistry(role)).toBe(expected[role]);
  });

  it("is a superset of canManagePersonRegistry — anyone who can edit can also view", () => {
    for (const role of ALL_ROLES) {
      if (canManagePersonRegistry(role)) expect(canViewPersonRegistry(role)).toBe(true);
    }
  });
});

describe("canManageEngagementsOnProject", () => {
  it("ADMIN and PM can assign engagements (PM further scoped to their own project at the call site); everyone else cannot", () => {
    const expected: Record<Role, boolean> = {
      ADMIN: true,
      PM: true,
      TPM: false,
      PROGRAM_MANAGER: false,
      CLIENT: false,
      LIMITED: false,
    };
    for (const role of ALL_ROLES) expect(canManageEngagementsOnProject(role)).toBe(expected[role]);
  });
});

describe("canViewPortfolioOverload", () => {
  it("only ADMIN and TPM see the portfolio-wide overload/conflict rollup — not PROGRAM_MANAGER, even though it now drills into projects elsewhere", () => {
    const expected: Record<Role, boolean> = {
      ADMIN: true,
      TPM: true,
      PROGRAM_MANAGER: false,
      CLIENT: false,
      PM: false,
      LIMITED: false,
    };
    for (const role of ALL_ROLES) expect(canViewPortfolioOverload(role)).toBe(expected[role]);
  });
});
