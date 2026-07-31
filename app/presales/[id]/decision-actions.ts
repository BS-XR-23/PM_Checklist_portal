"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireUser, writeAudit } from "@/lib/rbac";

async function requirePresalesWrite() {
  const user = await requireUser();
  if (user.role !== "PM" && user.role !== "ADMIN") {
    throw new Error("Only a PM or Admin can manage presales opportunities.");
  }
  return user;
}

function revalidateDecisions(presalesProjectId: string) {
  revalidatePath(`/presales/${presalesProjectId}`);
}

export async function createPresalesDecision(presalesProjectId: string) {
  const user = await requirePresalesWrite();

  const count = await prisma.presalesDecisionItem.count({ where: { presalesProjectId } });
  const created = await prisma.presalesDecisionItem.create({
    data: { presalesProjectId, decision: "New decision", order: count },
  });

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "PresalesDecisionItem",
    entityId: created.id,
    summary: "Added a new presales decision",
  });

  revalidateDecisions(presalesProjectId);
}

export async function updatePresalesDecision(
  id: string,
  presalesProjectId: string,
  data: Partial<{
    date: string | null;
    decision: string;
    rationale: string;
    decidedBy: string;
    decidedByPersonId: string | null;
    notes: string;
  }>
) {
  const existing = await prisma.presalesDecisionItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  await prisma.presalesDecisionItem.update({
    where: { id },
    data: {
      ...(data.date !== undefined ? { date: parseDateInput(data.date) } : {}),
      ...(data.decision !== undefined ? { decision: data.decision } : {}),
      ...(data.rationale !== undefined ? { rationale: data.rationale || null } : {}),
      ...(data.decidedBy !== undefined ? { decidedBy: data.decidedBy || null } : {}),
      ...(data.decidedByPersonId !== undefined ? { decidedByPersonId: data.decidedByPersonId } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
  });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesDecisionItem",
    entityId: id,
    summary: `Updated presales decision "${existing.decision.slice(0, 60)}"`,
    diff: { before: existing, changes: data },
  });

  revalidateDecisions(existing.presalesProjectId);
}

export async function deletePresalesDecision(id: string, _presalesProjectId: string) {
  const existing = await prisma.presalesDecisionItem.findUniqueOrThrow({ where: { id } });
  const user = await requirePresalesWrite();

  await prisma.presalesDecisionItem.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "PresalesDecisionItem",
    entityId: id,
    summary: `Deleted presales decision "${existing.decision.slice(0, 60)}"`,
    diff: { before: existing },
  });

  revalidateDecisions(existing.presalesProjectId);
}
