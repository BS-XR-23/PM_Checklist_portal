"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateMilestonePayment(
  id: string,
  projectId: string,
  data: Partial<{ paymentPct: number; invoiceStatus: string; clientSignoff: string; notes: string }>
) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  await prisma.milestonePayment.update({
    where: { id },
    data: {
      ...(data.paymentPct !== undefined ? { paymentPct: data.paymentPct } : {}),
      ...(data.invoiceStatus !== undefined ? { invoiceStatus: data.invoiceStatus } : {}),
      ...(data.clientSignoff !== undefined ? { clientSignoff: data.clientSignoff } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}/dashboard`);
}
