import "server-only";
import * as React from "react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role, ModuleName, AccessLevel, Prisma } from "@prisma/client";
import {
  meetsLevel,
  computeProjectAccess,
  computeModuleAccess,
  DEFAULT_CLIENT_PERMISSIONS,
  ALL_MODULES,
  type MembershipLike,
} from "@/lib/rbac-core";

export {
  meetsLevel,
  computeProjectAccess,
  computeModuleAccess,
  DEFAULT_CLIENT_PERMISSIONS,
  type MembershipLike,
};

// ---------------------------------------------------------------------------
// DB-touching helpers — used by pages and server actions.
// ---------------------------------------------------------------------------

// Next's webpack build aliases "react" to a canary build that has `cache()`
// (App Router request memoization); the plain react@18 package resolved by
// Vitest does not. Fall back to an identity wrapper outside Next's build so
// tests keep working — they don't need the dedup, only the dev/prod server does.
function cache<T extends (...args: never[]) => unknown>(fn: T): T {
  const reactCache = (React as { cache?: (fn: T) => T }).cache;
  return reactCache ? reactCache(fn) : fn;
}

export type CurrentUser = { id: string; email: string; name: string; role: Role };

/**
 * Identity comes from the session; role is always re-fetched fresh from the DB
 * rather than trusted from the JWT, so an Admin revoking/changing someone's
 * role takes effect immediately, not "next login."
 */
// Multiple helpers below (requireModuleAccess, getModuleAccess, a page's own
// sibling-module check, the layout's getProjectContext, ...) all resolve the
// same session user and project membership independently. `cache()` scopes
// per request in the App Router, so redundant calls within one render dedupe
// to a single DB round trip instead of each re-querying from scratch — this
// is what actually exhausted the connection pool under real navigation.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return null;

  const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!user) return null;
  // Same "immediate, not next login" philosophy as the role re-fetch below:
  // deactivating someone mid-session should cut their access on their very
  // next request, not wait for their JWT to expire.
  if (!user.isActive) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const getMembership = cache(async (userId: string, projectId: string): Promise<MembershipLike> => {
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { permissions: true },
  });
  if (!membership) return null;
  return { role: membership.role, permissions: membership.permissions };
});

/** For layouts/pages: 404s (never a "you're not allowed" page — existence isn't revealed) if the user can't enter this project at all. */
export async function requireProjectAccess(projectId: string): Promise<CurrentUser> {
  const user = await requireUser();
  const membership = await getMembership(user.id, projectId);
  if (!computeProjectAccess(user.role, membership)) notFound();
  return user;
}

/** Effective access level for one module of one project, for the current session user. */
export async function getModuleAccess(projectId: string, module: ModuleName): Promise<AccessLevel> {
  const user = await getCurrentUser();
  if (!user) return "NONE";
  const membership = await getMembership(user.id, projectId);
  return computeModuleAccess(user.role, membership, module);
}

/** For pages: 404s if access is below minLevel. Returns the actual level so the page can render accordingly. */
export async function requireModuleAccess(projectId: string, module: ModuleName, minLevel: AccessLevel): Promise<AccessLevel> {
  const access = await getModuleAccess(projectId, module);
  if (!meetsLevel(access, minLevel)) notFound();
  return access;
}

/**
 * One-shot: the coarse project gate plus every module's access level, so the
 * project layout can filter nav tabs without a query per tab. 404s if the
 * user can't enter the project at all.
 */
export async function getProjectContext(projectId: string): Promise<{
  user: CurrentUser;
  moduleAccess: Record<ModuleName, AccessLevel>;
}> {
  const user = await requireUser();
  const membership = await getMembership(user.id, projectId);
  if (!computeProjectAccess(user.role, membership)) notFound();

  const moduleAccess = Object.fromEntries(
    ALL_MODULES.map((m) => [m, computeModuleAccess(user.role, membership, m)])
  ) as Record<ModuleName, AccessLevel>;

  return { user, moduleAccess };
}

/** For server actions: throws (surfaces as a failed action) instead of 404ing. */
export async function requireModuleWrite(projectId: string, module: ModuleName): Promise<CurrentUser> {
  const user = await requireUser();
  const membership = await getMembership(user.id, projectId);
  const access = computeModuleAccess(user.role, membership, module);
  if (!meetsLevel(access, "WRITE")) {
    throw new Error(`Not authorized to write ${module} on this project.`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function writeAudit(input: {
  actor: CurrentUser;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  diff?: Prisma.InputJsonValue;
  isOverride?: boolean;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      projectId: input.projectId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      diff: input.diff,
      isOverride: input.isOverride ?? false,
    },
  });
}

/**
 * The only path that lets a TPM successfully mutate project data. Requires a
 * reason, always logs isOverride:true, and must be wired to a visually
 * distinct "Override" control in the UI — never the same edit affordance a
 * PM uses. Bypasses the normal WRITE gate by design (that's the point), but
 * only reachable from an action that explicitly calls this.
 */
export async function performTpmOverride<T>(input: {
  projectId: string;
  module: ModuleName;
  entityType: string;
  entityId?: string | null;
  reason: string;
  summary: string;
  diff?: Prisma.InputJsonValue;
  mutate: () => Promise<T>;
}): Promise<T> {
  const user = await requireUser();
  if (user.role !== "TPM" && user.role !== "ADMIN") {
    throw new Error("Only a TPM (or Admin) can perform an override.");
  }
  if (!input.reason.trim()) {
    throw new Error("An override reason is required.");
  }

  const result = await input.mutate();

  await writeAudit({
    actor: user,
    projectId: input.projectId,
    action: "override",
    entityType: input.entityType,
    entityId: input.entityId,
    summary: `TPM override: ${input.summary} — reason: ${input.reason.trim()}`,
    diff: input.diff,
    isOverride: true,
  });

  return result;
}
