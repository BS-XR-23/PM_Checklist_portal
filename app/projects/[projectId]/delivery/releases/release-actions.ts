"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";
import type { ReleaseType } from "@prisma/client";

function revalidateReleases(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery/releases`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}/delivery/uat`);
  revalidatePath(`/projects/${projectId}/activity`);
}

export async function createRelease(
  projectId: string,
  input: { version: string; name: string; type: ReleaseType; environment?: string | null }
) {
  const user = await requireModuleWrite(projectId, "RELEASE");

  const created = await prisma.release.create({
    data: { projectId, version: input.version, name: input.name, type: input.type, environment: input.environment || null },
  });

  await writeAudit({
    actor: user,
    projectId,
    action: "create",
    entityType: "Release",
    entityId: created.id,
    summary: `Added release "${input.version} — ${input.name}"`,
  });

  revalidateReleases(projectId);
  return created;
}

export async function updateRelease(
  id: string,
  projectId: string,
  data: Partial<{
    version: string;
    name: string;
    type: ReleaseType;
    environment: string | null;
    releaseDate: string | null;
    ownerPersonId: string | null;
    relatedMilestoneId: string | null;
    buildNumber: string | null;
    releaseNotes: string | null;
    deploymentStatus: string;
    rollbackVersion: string | null;
    approvalStatus: string;
    postReleaseValidation: string | null;
    knownIssues: string | null;
    uatSignoffStatus: string;
    uatSignoffDate: string | null;
    uatFeedback: string | null;
  }>
) {
  const existing = await prisma.release.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "RELEASE");

  await prisma.release.update({
    where: { id },
    data: {
      ...(data.version !== undefined ? { version: data.version } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.environment !== undefined ? { environment: data.environment || null } : {}),
      ...(data.releaseDate !== undefined ? { releaseDate: data.releaseDate ? new Date(data.releaseDate) : null } : {}),
      ...(data.ownerPersonId !== undefined ? { ownerPersonId: data.ownerPersonId || null } : {}),
      ...(data.relatedMilestoneId !== undefined ? { relatedMilestoneId: data.relatedMilestoneId || null } : {}),
      ...(data.buildNumber !== undefined ? { buildNumber: data.buildNumber || null } : {}),
      ...(data.releaseNotes !== undefined ? { releaseNotes: data.releaseNotes || null } : {}),
      ...(data.deploymentStatus !== undefined ? { deploymentStatus: data.deploymentStatus } : {}),
      ...(data.rollbackVersion !== undefined ? { rollbackVersion: data.rollbackVersion || null } : {}),
      ...(data.approvalStatus !== undefined ? { approvalStatus: data.approvalStatus } : {}),
      ...(data.postReleaseValidation !== undefined ? { postReleaseValidation: data.postReleaseValidation || null } : {}),
      ...(data.knownIssues !== undefined ? { knownIssues: data.knownIssues || null } : {}),
      ...(data.uatSignoffStatus !== undefined ? { uatSignoffStatus: data.uatSignoffStatus } : {}),
      ...(data.uatSignoffDate !== undefined ? { uatSignoffDate: data.uatSignoffDate ? new Date(data.uatSignoffDate) : null } : {}),
      ...(data.uatFeedback !== undefined ? { uatFeedback: data.uatFeedback || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "update",
    entityType: "Release",
    entityId: id,
    summary: `Updated release "${existing.version} — ${existing.name}"`,
    diff: { before: existing, changes: data },
  });

  revalidateReleases(existing.projectId);
}

export async function deleteRelease(id: string, _projectId: string) {
  const existing = await prisma.release.findUniqueOrThrow({ where: { id } });
  const user = await requireModuleWrite(existing.projectId, "RELEASE");

  await prisma.release.delete({ where: { id } });

  await writeAudit({
    actor: user,
    projectId: existing.projectId,
    action: "delete",
    entityType: "Release",
    entityId: id,
    summary: `Deleted release "${existing.version} — ${existing.name}"`,
    diff: { before: existing },
  });

  revalidateReleases(existing.projectId);
}

export async function toggleReleaseSprint(releaseId: string, sprintId: string, linked: boolean, _projectId: string) {
  const release = await prisma.release.findUniqueOrThrow({ where: { id: releaseId } });
  const user = await requireModuleWrite(release.projectId, "RELEASE");

  if (linked) {
    await prisma.releaseSprint.create({ data: { releaseId, sprintId } });
  } else {
    await prisma.releaseSprint.deleteMany({ where: { releaseId, sprintId } });
  }

  await writeAudit({
    actor: user,
    projectId: release.projectId,
    action: "update",
    entityType: "Release",
    entityId: releaseId,
    summary: `${linked ? "Linked" : "Unlinked"} a sprint to release "${release.version}"`,
  });

  revalidateReleases(release.projectId);
}

export async function toggleReleaseWbsTask(releaseId: string, wbsTaskId: string, linked: boolean, _projectId: string) {
  const release = await prisma.release.findUniqueOrThrow({ where: { id: releaseId } });
  const user = await requireModuleWrite(release.projectId, "RELEASE");

  if (linked) {
    await prisma.releaseWbsTask.create({ data: { releaseId, wbsTaskId } });
  } else {
    await prisma.releaseWbsTask.deleteMany({ where: { releaseId, wbsTaskId } });
  }

  await writeAudit({
    actor: user,
    projectId: release.projectId,
    action: "update",
    entityType: "Release",
    entityId: releaseId,
    summary: `${linked ? "Linked" : "Unlinked"} a WBS task to release "${release.version}"`,
  });

  revalidateReleases(release.projectId);
}
