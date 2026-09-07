"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireModuleWrite, writeAudit } from "@/lib/rbac";

function revalidatePmPlan(projectId: string) {
  revalidatePath(`/projects/${projectId}/pm-plan`);
  revalidatePath(`/projects/${projectId}/activity`);
}

async function authorizeByPmPlanId(pmPlanId: string) {
  const pmPlan = await prisma.pMPlan.findUniqueOrThrow({ where: { id: pmPlanId } });
  const user = await requireModuleWrite(pmPlan.projectId, "PM_PLAN");
  return { user, projectId: pmPlan.projectId };
}

export type PmPlanScalarField =
  | "preparedBy"
  | "planDate"
  | "version"
  | "rationale"
  | "charterObjective"
  | "charterScopeIn"
  | "charterScopeOut"
  | "charterSuccessCriteria"
  | "charterTimeline"
  | "charterBudget"
  | "charterAssumptions"
  | "charterPmAuthority"
  | "methodApproach"
  | "methodCadence"
  | "methodCeremonies"
  | "methodTools"
  | "methodRoles"
  | "methodChangeMgmt"
  | "testLevels"
  | "testEnvironments"
  | "testEntryCriteria"
  | "testExitCriteria"
  | "testDefectMgmt"
  | "testUatProcess"
  | "testDeliverables"
  | "deployEnvironments"
  | "deployReleaseStrategy"
  | "deploySteps"
  | "deployRollback"
  | "deployGoliveChecklist"
  | "deployMonitoring"
  | "escalationPath";

// The subset of PmPlanScalarField that gets an optional reference-link
// affordance in the UI — the long-form fields where the real detail usually
// lives in an external doc (a SOW, a runbook, a Jira board). Deliberately
// not every field: short factual ones (Version, Cadence, Approach, ...)
// gain nothing from a link and it would just be unused clutter there.
export type PmPlanLinkableField =
  | "rationale"
  | "charterScopeIn"
  | "charterScopeOut"
  | "charterSuccessCriteria"
  | "charterTimeline"
  | "methodCeremonies"
  | "methodChangeMgmt"
  | "testEntryCriteria"
  | "testExitCriteria"
  | "testDefectMgmt"
  | "testUatProcess"
  | "testDeliverables"
  | "deploySteps"
  | "deployRollback"
  | "deployGoliveChecklist"
  | "deployMonitoring"
  | "escalationPath";

export async function updatePmPlanFieldLink(pmPlanId: string, projectId: string, field: PmPlanLinkableField, url: string) {
  // Guessed-ID fix: authorize against the plan's real project.
  const { user, projectId: realProjectId } = await authorizeByPmPlanId(pmPlanId);
  const trimmed = url.trim();

  if (trimmed === "") {
    await prisma.pmPlanLink.deleteMany({ where: { pmPlanId, field } });
  } else {
    await prisma.pmPlanLink.upsert({
      where: { pmPlanId_field: { pmPlanId, field } },
      create: { pmPlanId, field, url: trimmed },
      update: { url: trimmed },
    });
  }

  await writeAudit({ actor: user, projectId: realProjectId, action: "update", entityType: "PmPlanLink", summary: `${trimmed ? "Set" : "Removed"} reference link for "${field}"` });

  revalidatePmPlan(realProjectId);
}

export async function updatePmPlanField(pmPlanId: string, projectId: string, field: PmPlanScalarField, value: string) {
  // Guessed-ID fix: authorize against the plan's real project.
  const { user, projectId: realProjectId } = await authorizeByPmPlanId(pmPlanId);

  if (field === "planDate") {
    await prisma.pMPlan.update({ where: { id: pmPlanId }, data: { planDate: parseDateInput(value) } });
  } else {
    await prisma.pMPlan.update({ where: { id: pmPlanId }, data: { [field]: value || null } });
  }

  await writeAudit({ actor: user, projectId: realProjectId, action: "update", entityType: "PMPlan", entityId: pmPlanId, summary: `Updated PM Plan field "${field}"` });

  revalidatePmPlan(realProjectId);
}

// --- Stakeholder rows ---

export async function addStakeholderRow(pmPlanId: string, _projectId: string) {
  const { user, projectId: realProjectId } = await authorizeByPmPlanId(pmPlanId);
  const count = await prisma.stakeholderRow.count({ where: { pmPlanId } });
  await prisma.stakeholderRow.create({
    data: { pmPlanId, order: count, stakeholder: "New stakeholder", role: "", responsibility: "", accessRequired: "" },
  });
  await writeAudit({ actor: user, projectId: realProjectId, action: "create", entityType: "StakeholderRow", summary: "Added a stakeholder row" });
  revalidatePmPlan(realProjectId);
}

export async function updateStakeholderRow(
  id: string,
  projectId: string,
  data: Partial<{ stakeholder: string; personId: string | null; role: string; responsibility: string; accessRequired: string }>
) {
  const existing = await prisma.stakeholderRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.stakeholderRow.update({ where: { id }, data });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "update", entityType: "StakeholderRow", entityId: id, summary: "Updated a stakeholder row", diff: { before: existing, changes: data } });
  revalidatePmPlan(existing.pmPlan.projectId);
}

export async function deleteStakeholderRow(id: string, _projectId: string) {
  const existing = await prisma.stakeholderRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.stakeholderRow.delete({ where: { id } });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "delete", entityType: "StakeholderRow", entityId: id, summary: "Deleted a stakeholder row", diff: { before: existing } });
  revalidatePmPlan(existing.pmPlan.projectId);
}

// --- Communications rows ---

export async function addCommsRow(pmPlanId: string, _projectId: string) {
  const { user, projectId: realProjectId } = await authorizeByPmPlanId(pmPlanId);
  const count = await prisma.commsRow.count({ where: { pmPlanId } });
  await prisma.commsRow.create({
    data: { pmPlanId, order: count, audience: "New audience", frequency: "", channel: "", content: "" },
  });
  await writeAudit({ actor: user, projectId: realProjectId, action: "create", entityType: "CommsRow", summary: "Added a communications row" });
  revalidatePmPlan(realProjectId);
}

export async function updateCommsRow(
  id: string,
  projectId: string,
  data: Partial<{ audience: string; frequency: string; channel: string; content: string }>
) {
  const existing = await prisma.commsRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.commsRow.update({ where: { id }, data });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "update", entityType: "CommsRow", entityId: id, summary: "Updated a communications row", diff: { before: existing, changes: data } });
  revalidatePmPlan(existing.pmPlan.projectId);
}

export async function deleteCommsRow(id: string, _projectId: string) {
  const existing = await prisma.commsRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.commsRow.delete({ where: { id } });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "delete", entityType: "CommsRow", entityId: id, summary: "Deleted a communications row", diff: { before: existing } });
  revalidatePmPlan(existing.pmPlan.projectId);
}

// --- RACI rows ---

export async function addRaciRow(pmPlanId: string, _projectId: string) {
  const { user, projectId: realProjectId } = await authorizeByPmPlanId(pmPlanId);
  const count = await prisma.raciRow.count({ where: { pmPlanId } });
  await prisma.raciRow.create({
    data: { pmPlanId, order: count, activity: "New activity", pm: "", tl: "", ba: "", leadEng: "", creativeLead: "" },
  });
  await writeAudit({ actor: user, projectId: realProjectId, action: "create", entityType: "RaciRow", summary: "Added a RACI row" });
  revalidatePmPlan(realProjectId);
}

export async function updateRaciRow(
  id: string,
  projectId: string,
  data: Partial<{ activity: string; pm: string; tl: string; ba: string; leadEng: string; creativeLead: string }>
) {
  const existing = await prisma.raciRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.raciRow.update({ where: { id }, data });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "update", entityType: "RaciRow", entityId: id, summary: "Updated a RACI row", diff: { before: existing, changes: data } });
  revalidatePmPlan(existing.pmPlan.projectId);
}

export async function deleteRaciRow(id: string, _projectId: string) {
  const existing = await prisma.raciRow.findUniqueOrThrow({ where: { id }, include: { pmPlan: true } });
  const user = await requireModuleWrite(existing.pmPlan.projectId, "PM_PLAN");
  await prisma.raciRow.delete({ where: { id } });
  await writeAudit({ actor: user, projectId: existing.pmPlan.projectId, action: "delete", entityType: "RaciRow", entityId: id, summary: "Deleted a RACI row", diff: { before: existing } });
  revalidatePmPlan(existing.pmPlan.projectId);
}
