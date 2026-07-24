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

export async function createChangeRequest(projectId: string) {
  await requireSession();

  const existing = await prisma.changeRequest.findMany({ where: { projectId }, select: { crCode: true } });
  const maxNum = existing.reduce((max, cr) => {
    const n = parseInt(cr.crCode.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const crCode = `CR-${String(maxNum + 1).padStart(3, "0")}`;

  await prisma.changeRequest.create({
    data: { projectId, crCode, title: "New change request" },
  });

  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function updateChangeRequest(
  id: string,
  projectId: string,
  data: Partial<{
    title: string;
    dateRaised: string | null;
    description: string;
    manDaysPlanned: number | null;
    billableManDays: number | null;
    rate: number | null;
    type: string;
    clientSignoff: string;
    wbsUpdated: string;
    status: string;
    notes: string;
  }>
) {
  await requireSession();

  await prisma.changeRequest.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.dateRaised !== undefined ? { dateRaised: parseDateInput(data.dateRaised) } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.manDaysPlanned !== undefined ? { manDaysPlanned: data.manDaysPlanned } : {}),
      ...(data.billableManDays !== undefined ? { billableManDays: data.billableManDays } : {}),
      ...(data.rate !== undefined ? { rate: data.rate } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.clientSignoff !== undefined ? { clientSignoff: data.clientSignoff } : {}),
      ...(data.wbsUpdated !== undefined ? { wbsUpdated: data.wbsUpdated } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}

export async function deleteChangeRequest(id: string, projectId: string) {
  await requireSession();
  await prisma.changeRequest.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}
