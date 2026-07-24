"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import type { ChecklistType, ItemStatus } from "@/lib/constants";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function updateChecklistItem(
  itemId: string,
  projectId: string,
  checklistType: ChecklistType,
  data: Partial<{ owner: string; plannedDate: string | null; forecastDate: string | null; status: ItemStatus; notes: string }>
) {
  await requireSession();

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
      ...(data.plannedDate !== undefined ? { plannedDate: parseDateInput(data.plannedDate) } : {}),
      ...(data.forecastDate !== undefined ? { forecastDate: parseDateInput(data.forecastDate) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  const path = checklistType === "PM" ? "pm-checklist" : "devops-checklist";
  revalidatePath(`/projects/${projectId}/${path}`);
  revalidatePath(`/projects/${projectId}/dashboard`);
  revalidatePath(`/projects/${projectId}/milestones`);
}
