"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
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

export async function updatePmPlanField(pmPlanId: string, projectId: string, field: PmPlanScalarField, value: string) {
  await requireSession();

  if (field === "planDate") {
    await prisma.pMPlan.update({ where: { id: pmPlanId }, data: { planDate: parseDateInput(value) } });
  } else {
    await prisma.pMPlan.update({ where: { id: pmPlanId }, data: { [field]: value || null } });
  }

  revalidatePath(`/projects/${projectId}/pm-plan`);
}

// --- Stakeholder rows ---

export async function addStakeholderRow(pmPlanId: string, projectId: string) {
  await requireSession();
  const count = await prisma.stakeholderRow.count({ where: { pmPlanId } });
  await prisma.stakeholderRow.create({
    data: { pmPlanId, order: count, stakeholder: "New stakeholder", role: "", responsibility: "", accessRequired: "" },
  });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function updateStakeholderRow(
  id: string,
  projectId: string,
  data: Partial<{ stakeholder: string; role: string; responsibility: string; accessRequired: string }>
) {
  await requireSession();
  await prisma.stakeholderRow.update({ where: { id }, data });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function deleteStakeholderRow(id: string, projectId: string) {
  await requireSession();
  await prisma.stakeholderRow.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

// --- Communications rows ---

export async function addCommsRow(pmPlanId: string, projectId: string) {
  await requireSession();
  const count = await prisma.commsRow.count({ where: { pmPlanId } });
  await prisma.commsRow.create({
    data: { pmPlanId, order: count, audience: "New audience", frequency: "", channel: "", content: "" },
  });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function updateCommsRow(
  id: string,
  projectId: string,
  data: Partial<{ audience: string; frequency: string; channel: string; content: string }>
) {
  await requireSession();
  await prisma.commsRow.update({ where: { id }, data });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function deleteCommsRow(id: string, projectId: string) {
  await requireSession();
  await prisma.commsRow.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

// --- RACI rows ---

export async function addRaciRow(pmPlanId: string, projectId: string) {
  await requireSession();
  const count = await prisma.raciRow.count({ where: { pmPlanId } });
  await prisma.raciRow.create({
    data: { pmPlanId, order: count, activity: "New activity", pm: "", tl: "", ba: "", leadEng: "", creativeLead: "" },
  });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function updateRaciRow(
  id: string,
  projectId: string,
  data: Partial<{ activity: string; pm: string; tl: string; ba: string; leadEng: string; creativeLead: string }>
) {
  await requireSession();
  await prisma.raciRow.update({ where: { id }, data });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}

export async function deleteRaciRow(id: string, projectId: string) {
  await requireSession();
  await prisma.raciRow.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/pm-plan`);
}
