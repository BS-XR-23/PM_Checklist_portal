"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/format";
import { requireUser, writeAudit, type CurrentUser } from "@/lib/rbac";
import { createProject } from "@/lib/create-project";

// Presales isn't a module of a project — it's its own entity — so
// authorization here is a plain role check, the same shape the top-level
// Project actions already use (app/projects/actions.ts), not the
// requireModuleWrite/ModuleName machinery.
async function requirePresalesWrite(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "PM" && user.role !== "ADMIN") {
    throw new Error("Only a PM or Admin can manage presales opportunities.");
  }
  return user;
}

function revalidatePresales(id?: string) {
  revalidatePath("/presales");
  if (id) revalidatePath(`/presales/${id}`);
}

export async function createPresalesProject(formData: FormData) {
  const user = await requirePresalesWrite();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Opportunity name is required.");
  const client = String(formData.get("client") ?? "").trim();
  const estimatedValueRaw = formData.get("estimatedValue");
  const estimatedValue = estimatedValueRaw ? Number(estimatedValueRaw) : null;
  const expectedCloseDate = parseDateInput(String(formData.get("expectedCloseDate") ?? "") || null);

  const created = await prisma.presalesProject.create({
    data: { name, client: client || null, estimatedValue, expectedCloseDate, createdById: user.id },
  });

  // Seed the standard presales playbook (Admin-managed, app/admin/checklist-
  // template) onto every new opportunity, same idea as createProject()
  // seeding a new project's checklist from ChecklistTemplateItem.
  const templateItems = await prisma.presalesChecklistTemplateItem.findMany({ orderBy: { order: "asc" } });
  if (templateItems.length > 0) {
    await prisma.presalesChecklistItem.createMany({
      data: templateItems.map((t) => ({ presalesProjectId: created.id, order: t.order, itemText: t.itemText, isCustom: false })),
    });
  }

  await writeAudit({
    actor: user,
    action: "create",
    entityType: "PresalesProject",
    entityId: created.id,
    summary: `Created presales opportunity "${created.name}"`,
  });

  revalidatePresales();
  redirect(`/presales/${created.id}`);
}

export async function updatePresalesProject(
  id: string,
  data: Partial<{
    name: string;
    client: string;
    description: string;
    estimatedValue: number | null;
    expectedCloseDate: string | null;
  }>
) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });

  await prisma.presalesProject.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.client !== undefined ? { client: data.client || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.estimatedValue !== undefined ? { estimatedValue: data.estimatedValue } : {}),
      ...(data.expectedCloseDate !== undefined ? { expectedCloseDate: parseDateInput(data.expectedCloseDate) } : {}),
    },
  });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Updated presales opportunity "${existing.name}"`,
    diff: { before: existing, changes: data },
  });

  revalidatePresales(id);
}

export async function deletePresalesProject(id: string) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });

  await prisma.presalesProject.update({ where: { id }, data: { deletedAt: new Date() } });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Deleted presales opportunity "${existing.name}"`,
  });

  revalidatePresales();
}

export async function restorePresalesProject(id: string) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });

  await prisma.presalesProject.update({ where: { id }, data: { deletedAt: null } });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Restored presales opportunity "${existing.name}"`,
  });

  revalidatePresales();
}

export async function permanentlyDeletePresalesProject(id: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can permanently delete a presales opportunity.");
  }

  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });
  if (!existing.deletedAt) {
    throw new Error("Only a soft-deleted opportunity can be permanently deleted — delete it first.");
  }

  await prisma.presalesProject.delete({ where: { id } });

  await writeAudit({
    actor: user,
    action: "delete",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Permanently deleted presales opportunity "${existing.name}"`,
  });

  revalidatePresales();
}

export async function markPresalesLost(id: string, lostReason: string) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });
  if (existing.outcome !== "OPEN") {
    throw new Error("Only an open opportunity can be marked Lost.");
  }

  await prisma.presalesProject.update({
    where: { id },
    data: { outcome: "LOST", lostReason: lostReason.trim() || null },
  });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Marked presales opportunity "${existing.name}" as Lost`,
  });

  revalidatePresales(id);
}

export async function reopenPresalesProject(id: string) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({ where: { id } });
  if (existing.outcome !== "LOST") {
    throw new Error("Only a Lost opportunity can be reopened.");
  }

  await prisma.presalesProject.update({ where: { id }, data: { outcome: "OPEN", lostReason: null } });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Reopened presales opportunity "${existing.name}"`,
  });

  revalidatePresales(id);
}

export async function winPresalesProject(id: string) {
  const user = await requirePresalesWrite();
  const existing = await prisma.presalesProject.findUniqueOrThrow({
    where: { id },
    include: {
      decisions: { orderBy: { order: "asc" } },
      actionItems: { orderBy: { order: "asc" } },
      checklistItems: { orderBy: { order: "asc" } },
    },
  });
  if (existing.outcome !== "OPEN") {
    throw new Error("Only an open opportunity can be marked Won.");
  }

  const project = await createProject({
    name: existing.name,
    client: existing.client ?? undefined,
    contractValue: existing.estimatedValue ?? 0,
  });

  // Everything already discussed/decided during the pitch should be sitting
  // there for the delivery PM on day one, not left behind in the presales
  // record.
  if (existing.decisions.length > 0) {
    await prisma.decisionLogItem.createMany({
      data: existing.decisions.map((d) => ({
        projectId: project.id,
        order: d.order,
        date: d.date,
        decision: d.decision,
        rationale: d.rationale,
        decidedBy: d.decidedBy,
        decidedByPersonId: d.decidedByPersonId,
        notes: d.notes,
      })),
    });
  }
  if (existing.actionItems.length > 0) {
    await prisma.actionItem.createMany({
      data: existing.actionItems.map((a) => ({
        projectId: project.id,
        order: a.order,
        description: a.description,
        ownerPersonId: a.ownerPersonId,
        owner: a.owner,
        dueDate: a.dueDate,
        status: a.status,
        notes: a.notes,
      })),
    });
  }
  if (existing.checklistItems.length > 0) {
    // Folded into the PM Checklist as its own "Presales" stage (prepended
    // to PM_STAGES, lib/seed-data.ts) — these count toward the project's
    // overall % complete/RAG like any other checklist item. Negative order
    // values sort them before the template's order 1..51 PM items without
    // colliding with @@unique([projectId, type, order]), which only needs
    // uniqueness, not positivity or contiguity.
    const n = existing.checklistItems.length;
    await prisma.checklistItem.createMany({
      data: existing.checklistItems.map((c, i) => ({
        projectId: project.id,
        type: "PM",
        stage: "Presales",
        order: -(n - i),
        itemText: c.itemText,
        status: c.status,
        plannedDate: c.plannedDate,
        forecastDate: c.forecastDate,
        owner: c.owner,
        ownerPersonId: c.ownerPersonId,
        notes: c.notes,
        isCustom: c.isCustom,
      })),
    });
  }

  await prisma.presalesProject.update({ where: { id }, data: { outcome: "WON", wonProjectId: project.id } });

  await writeAudit({
    actor: user,
    action: "update",
    entityType: "PresalesProject",
    entityId: id,
    summary: `Marked presales opportunity "${existing.name}" as Won`,
  });
  await writeAudit({
    actor: user,
    projectId: project.id,
    action: "create",
    entityType: "Project",
    entityId: project.id,
    summary: `Created project "${project.name}" from a won presales opportunity`,
  });

  revalidatePresales(id);
  redirect(`/projects/${project.id}/dashboard`);
}
