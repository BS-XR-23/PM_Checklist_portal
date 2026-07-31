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
  source: "CHECKLIST" | "ACTION_ITEM";
  route: string;
  context: string;
  itemText: string;
  plannedDate: Date;
  band: "OVERDUE" | "DUE_SOON";
};

async function reminderItemsRaw(user: CurrentUser): Promise<ReminderItem[]> {
  const projectIds = await visibleActiveProjectIds(user);
  if (projectIds.length === 0) return [];

  const [checklistItems, actionItems] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { projectId: { in: projectIds }, status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] }, plannedDate: { not: null } },
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.actionItem.findMany({
      where: { projectId: { in: projectIds }, status: { not: "Done" }, dueDate: { not: null } },
      include: { project: { select: { id: true, name: true } }, ownerPerson: { select: { name: true } } },
    }),
  ]);

  const checklistReminders = checklistItems
    .map((i) => ({ i, band: reminderBand(i.plannedDate, i.status === "COMPLETED" || i.status === "NOT_APPLICABLE") }))
    .filter((x): x is { i: (typeof checklistItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ i, band }) => ({
      projectId: i.project.id,
      projectName: i.project.name,
      source: "CHECKLIST" as const,
      route: i.type === "PM" ? "pm-checklist" : "devops-checklist",
      context: i.stage,
      itemText: i.itemText,
      plannedDate: i.plannedDate as Date,
      band,
    }));

  const actionItemReminders = actionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done") }))
    .filter((x): x is { a: (typeof actionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      projectId: a.project.id,
      projectName: a.project.name,
      source: "ACTION_ITEM" as const,
      route: "action-items",
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
    }));

  return [...checklistReminders, ...actionItemReminders].sort((a, b) => {
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
