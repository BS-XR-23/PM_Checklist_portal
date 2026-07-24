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

export async function createRisk(projectId: string) {
  await requireSession();

  const count = await prisma.riskItem.count({ where: { projectId } });
  await prisma.riskItem.create({
    data: { projectId, description: "New risk/opportunity/issue", order: count },
  });

  revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function updateRisk(
  id: string,
  projectId: string,
  data: Partial<{
    type: string;
    category: string;
    description: string;
    probability: string;
    impact: string;
    owner: string;
    mitigation: string;
    status: string;
    dateRaised: string | null;
    dateClosed: string | null;
    notes: string;
  }>
) {
  await requireSession();

  await prisma.riskItem.update({
    where: { id },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.probability !== undefined ? { probability: data.probability } : {}),
      ...(data.impact !== undefined ? { impact: data.impact } : {}),
      ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
      ...(data.mitigation !== undefined ? { mitigation: data.mitigation || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dateRaised !== undefined ? { dateRaised: parseDateInput(data.dateRaised) } : {}),
      ...(data.dateClosed !== undefined ? { dateClosed: parseDateInput(data.dateClosed) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function deleteRisk(id: string, projectId: string) {
  await requireSession();
  await prisma.riskItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/risks`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}
