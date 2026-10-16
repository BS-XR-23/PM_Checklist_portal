import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail, membershipRoleAllowed, membershipRoleAfterGlobalChange, needsPersonLink, suggestUserForPerson } from "./user-rules";

describe("email", () => {
  it("accepts ordinary addresses and normalizes them", () => {
    expect(isValidEmail("anika.tabassum@brainstation-23.com")).toBe(true);
    expect(normalizeEmail("  Ziad@BrainStation-23.com ")).toBe("ziad@brainstation-23.com");
  });

  it("refuses blanks and obvious typos", () => {
    for (const bad of ["", "   ", "ziad", "ziad@", "@bs23.com", "ziad@bs23", "zi ad@bs23.com"]) expect(isValidEmail(bad)).toBe(false);
    expect(() => normalizeEmail("ziad@bs23")).toThrow();
  });
});

describe("membership roles", () => {
  it("a membership can't exceed the global role", () => {
    expect(membershipRoleAllowed("PM", "PM")).toBe(true);
    expect(membershipRoleAllowed("PM", "LIMITED")).toBe(true);
    expect(membershipRoleAllowed("LIMITED", "PM")).toBe(false);
    expect(membershipRoleAllowed("CLIENT", "LIMITED")).toBe(true);
    expect(membershipRoleAllowed("LIMITED", "CLIENT")).toBe(false);
    expect(membershipRoleAllowed("ADMIN", "PM")).toBe(false); // global scope, no memberships
  });

  it("memberships follow the global role down, never up", () => {
    expect(membershipRoleAfterGlobalChange("LIMITED", "PM")).toBe("LIMITED");
    expect(membershipRoleAfterGlobalChange("CLIENT", "PM")).toBe("CLIENT");
    expect(membershipRoleAfterGlobalChange("PM", "LIMITED")).toBeNull(); // promotion leaves project roles alone
    expect(membershipRoleAfterGlobalChange("TPM", "PM")).toBeNull(); // global scope — memberships ignored
  });
});

describe("needsPersonLink", () => {
  it("staff roles only", () => {
    expect(needsPersonLink("PM")).toBe(true);
    expect(needsPersonLink("TPM")).toBe(true);
    expect(needsPersonLink("CLIENT")).toBe(false);
    expect(needsPersonLink("LIMITED")).toBe(false);
  });
});

describe("suggestUserForPerson", () => {
  const users = [
    { id: "1", name: "Ezaz", email: "ezazul.haque@brainstation-23.com" },
    { id: "2", name: "Md. Nahidul Islam", email: "nahidul.bs23@gmail.com" },
    { id: "3", name: "Nahid", email: "nahidul.islam@brainstation-23.com" },
    { id: "4", name: "Sam", email: "sam1@x.com" },
    { id: "5", name: "Sam", email: "sam2@x.com" },
  ];

  it("email beats name; a unique name match is the fallback", () => {
    expect(suggestUserForPerson({ name: "Md. Ezazul Haque", email: "Ezazul.Haque@brainstation-23.com" }, users)).toEqual({ user: users[0], by: "email" });
    expect(suggestUserForPerson({ name: "Md. Nahidul Islam", email: "nahidul.islam@brainstation-23.com" }, users)).toEqual({ user: users[2], by: "email" });
    expect(suggestUserForPerson({ name: " md. nahidul islam ", email: null }, users)).toEqual({ user: users[1], by: "name" });
  });

  it("no match, or an ambiguous name, suggests nothing", () => {
    expect(suggestUserForPerson({ name: "Akif Zaman", email: "akif@bs23.com" }, users)).toBeNull();
    expect(suggestUserForPerson({ name: "Sam", email: null }, users)).toBeNull();
  });
});
