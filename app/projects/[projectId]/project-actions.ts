"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function updateProjectFinancials(
  projectId: string,
  data: Partial<{ contractValue: number; plannedManDays: number; crRate: number }>
) {
  await requireSession();

  await prisma.project.update({
    where: { id: projectId },
    data,
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/change-requests`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}
