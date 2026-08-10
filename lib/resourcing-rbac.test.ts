import { describe, it, expect } from "vitest";
import {
  canViewResourcing,
  canManagePersonRegistry,
  canManageEngagementsOnProject,
  canViewPortfolioOverload,
} from "./resourcing-rbac";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"];

describe("canViewResourcing", () => {
  it("ADMIN, TPM, PM can view; PROGRAM_MANAGER, CLIENT, LIMITED cannot", () => {
    const expected: Record<Role, boolean> = {
      ADMIN: true,
      TPM: true,
      PM: true,
      PROGRAM_MANAGER: false,
      CLIENT: false,
      LIMITED: false,
    };
    for (const role of ALL_ROLES) expect(canViewResourcing(role)).toBe(expected[role]);
  });
});

describe("canManagePersonRegistry", () => {
  it("only ADMIN owns the canonical Person registry", () => {
    for (const role of ALL_ROLES) expect(canManagePersonRegistry(role)).toBe(role === "ADMIN");
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
  it("only ADMIN and TPM see the portfolio-wide overload/conflict rollup — not PROGRAM_MANAGER, per the coarse-only mandate", () => {
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
