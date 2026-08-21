"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireProjectAccess,
  writeAudit,
  DEFAULT_CLIENT_PERMISSIONS,
  DEFAULT_LIMITED_PERMISSIONS,
  ACCESS_PRESETS,
} from "@/lib/rbac";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";

const ASSIGNABLE_ROLES: Role[] = ["PM", "CLIENT", "LIMITED"];

async function requireTeamAdmin(projectId: string) {
  // Only Admin edits membership; enforced here (not just in the UI).
  const user = await requireUser();
  await requireProjectAccess(projectId); // 404 rather than reveal existence to an outsider
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can manage project team membership.");
  }
  return user;
}

export async function addProjectMember(projectId: string, email: string, role: Role) {
  const user = await requireTeamAdmin(projectId);

  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new Error(`Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}. Super Admin/Admin/Management get scope from their global role, not project assignment.`);
  }

  const targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!targetUser) {
    throw new Error(`No user with email ${email}. Create the user first (Admin > Users).`);
  }

  const membership = await prisma.projectMembership.create({
    data: { userId: targetUser.id, projectId, role },
  });

  // A new CLIENT gets the locked-down default permission set immediately
  // (secure-by-default); a new LIMITED/Guest gets the wider READ_LIMITED
  // baseline (DEFAULT_LIMITED_PERMISSIONS) — both are starting points only,
  // freely narrowed or widened afterward on this Team tab.
  const defaultPermissions = role === "CLIENT" ? DEFAULT_CLIENT_PERMISSIONS : role === "LIMITED" ? DEFAULT_LIMITED_PERMISSIONS : null;
  if (defaultPermissions) {
    await prisma.modulePermission.createMany({
      data: defaultPermissions.map((p) => ({ membershipId: membership.id, module: p.module, access: p.access })),
    });
  }

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "ProjectMembership",
    entityId: membership.id,
    summary: `Added ${targetUser.email} to the project as ${role}`,
  });

  revalidatePath(`/projects/${projectId}/team`);
}

export async function removeProjectMember(membershipId: string, projectId: string) {
  const user = await requireTeamAdmin(projectId);

  const existing = await prisma.projectMembership.findUniqueOrThrow({ where: { id: membershipId }, include: { user: true } });
  if (existing.projectId !== projectId) throw new Error("Membership does not belong to this project.");

  await prisma.projectMembership.delete({ where: { id: membershipId } });

  await writeAudit({
    actor: user,
    projectId,
    action: "delete",
    entityType: "ProjectMembership",
    entityId: membershipId,
    summary: `Removed ${existing.user.email} (${existing.role}) from the project`,
  });

  revalidatePath(`/projects/${projectId}/team`);
}

/** Bulk-sets every module in one preset's list in a single transaction — same upsert as setModulePermission, just looped. */
export async function applyAccessPreset(membershipId: string, projectId: string, presetKey: string) {
  const user = await requireTeamAdmin(projectId);

  const membership = await prisma.projectMembership.findUniqueOrThrow({ where: { id: membershipId } });
  if (membership.projectId !== projectId) throw new Error("Membership does not belong to this project.");
  if (membership.role !== "CLIENT" && membership.role !== "LIMITED") {
    throw new Error("Access presets only apply to CLIENT and LIMITED members.");
  }

  const preset = ACCESS_PRESETS.find((p) => p.key === presetKey);
  if (!preset) throw new Error(`Unknown access preset: ${presetKey}`);

  await prisma.$transaction(
    preset.permissions.map((p) =>
      prisma.modulePermission.upsert({
        where: { membershipId_module: { membershipId, module: p.module } },
        create: { membershipId, module: p.module, access: p.access },
        update: { access: p.access },
      })
    )
  );

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "ModulePermission",
    entityId: membershipId,
    summary: `Applied "${preset.label}" access preset to a ${membership.role} member`,
  });

  revalidatePath(`/projects/${projectId}/team`);
}

export async function setModulePermission(membershipId: string, projectId: string, module: ModuleName, access: AccessLevel) {
  const user = await requireTeamAdmin(projectId);

  const membership = await prisma.projectMembership.findUniqueOrThrow({ where: { id: membershipId } });
  if (membership.projectId !== projectId) throw new Error("Membership does not belong to this project.");
  if (membership.role !== "CLIENT" && membership.role !== "LIMITED") {
    throw new Error("Per-module permissions only apply to CLIENT and LIMITED members.");
  }

  await prisma.modulePermission.upsert({
    where: { membershipId_module: { membershipId, module } },
    create: { membershipId, module, access },
    update: { access },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "update",
    entityType: "ModulePermission",
    entityId: membershipId,
    summary: `Set ${module} access to ${access} for a ${membership.role} member`,
  });

  revalidatePath(`/projects/${projectId}/team`);
}
