import "server-only";
import { prisma } from "@/lib/prisma";
import { reminderBand } from "@/lib/calculations";
import type { CurrentUser } from "@/lib/rbac";
import type { Role } from "@prisma/client";

// Item-level reminders are deliberately scoped to the roles that own or
// directly manage checklist work. Not PROGRAM_MANAGER — that role's
// Portfolio view is kept at the aggregate level with no drill-down into
// item-level data (see app/portfolio/page.tsx). Not CLIENT/LIMITED — an
// overdue-item list is a PM-facing safety net, not something to surface
// outward.
const REMINDER_ROLES: Role[] = ["ADMIN", "TPM", "PM"];

async function visibleActiveProjectIds(user: CurrentUser): Promise<string[]> {
  if (!REMINDER_ROLES.includes(user.role)) return [];
  const where = user.role === "PM" ? { memberships: { some: { userId: user.id } } } : {};
  const projects = await prisma.project.findMany({
    where: { ...where, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export type ReminderItem = {
  projectId: string;
  projectName: string;
  type: string;
  stage: string;
  itemText: string;
  plannedDate: Date;
  band: "OVERDUE" | "DUE_SOON";
};

async function reminderItemsRaw(user: CurrentUser): Promise<ReminderItem[]> {
  const projectIds = await visibleActiveProjectIds(user);
  if (projectIds.length === 0) return [];

  const items = await prisma.checklistItem.findMany({
    where: { projectId: { in: projectIds }, status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] }, plannedDate: { not: null } },
    include: { project: { select: { id: true, name: true } } },
  });

  return items
    .map((i) => ({ item: i, band: reminderBand(i.plannedDate, i.status) }))
    .filter((x): x is { item: (typeof items)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ item, band }) => ({
      projectId: item.project.id,
      projectName: item.project.name,
      type: item.type,
      stage: item.stage,
      itemText: item.itemText,
      plannedDate: item.plannedDate as Date,
      band,
    }))
    .sort((a, b) => {
      if (a.band !== b.band) return a.band === "OVERDUE" ? -1 : 1;
      return a.plannedDate.getTime() - b.plannedDate.getTime();
    });
}

export async function getReminderCount(user: CurrentUser): Promise<number> {
  const items = await reminderItemsRaw(user);
  return items.length;
}

export async function getReminderItems(user: CurrentUser): Promise<ReminderItem[]> {
  return reminderItemsRaw(user);
}
