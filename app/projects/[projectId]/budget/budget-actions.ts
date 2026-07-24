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

export async function createBudgetEntry(projectId: string) {
  await requireSession();

  const last = await prisma.budgetEntry.findFirst({ where: { projectId }, orderBy: { weekEnding: "desc" } });
  const nextWeek = last ? new Date(last.weekEnding.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();

  await prisma.budgetEntry.create({
    data: { projectId, weekEnding: nextWeek, pctPlannedComplete: 0, pctActualComplete: 0, actualCost: 0 },
  });

  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function updateBudgetEntry(
  id: string,
  projectId: string,
  data: Partial<{ weekEnding: string; pctPlannedComplete: number; pctActualComplete: number; actualCost: number; notes: string }>
) {
  await requireSession();

  await prisma.budgetEntry.update({
    where: { id },
    data: {
      ...(data.weekEnding !== undefined ? { weekEnding: parseDateInput(data.weekEnding) ?? new Date() } : {}),
      ...(data.pctPlannedComplete !== undefined ? { pctPlannedComplete: data.pctPlannedComplete } : {}),
      ...(data.pctActualComplete !== undefined ? { pctActualComplete: data.pctActualComplete } : {}),
      ...(data.actualCost !== undefined ? { actualCost: data.actualCost } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function deleteBudgetEntry(id: string, projectId: string) {
  await requireSession();
  await prisma.budgetEntry.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}
