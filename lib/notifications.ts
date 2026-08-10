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
  href: string;
  contextLabel: string; // project name, or the opportunity name for a presales reminder
  projectId?: string; // present for CHECKLIST/ACTION_ITEM only — a presales reminder isn't scoped to a project
  source: "CHECKLIST" | "ACTION_ITEM" | "PRESALES_OPPORTUNITY" | "PRESALES_ACTION_ITEM";
  context: string; // stage / owner / client — the subtitle's first segment
  itemText: string;
  plannedDate: Date;
  band: "OVERDUE" | "DUE_SOON";
};

async function reminderItemsRaw(user: CurrentUser): Promise<ReminderItem[]> {
  if (!REMINDER_ROLES.includes(user.role)) return [];
  const projectIds = await visibleActiveProjectIds(user);

  const [checklistItems, actionItems, presalesOpportunities, presalesActionItems] = await Promise.all([
    projectIds.length === 0
      ? []
      : prisma.checklistItem.findMany({
          where: { projectId: { in: projectIds }, status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] }, plannedDate: { not: null } },
          include: { project: { select: { id: true, name: true } } },
        }),
    projectIds.length === 0
      ? []
      : prisma.actionItem.findMany({
          where: { projectId: { in: projectIds }, status: { not: "Done" }, dueDate: { not: null } },
          include: { project: { select: { id: true, name: true } }, ownerPerson: { select: { name: true } } },
        }),
    // Presales isn't project-scoped (no membership concept — any of these
    // roles already sees every opportunity via app/presales/page.tsx), so
    // no visibleActiveProjectIds-style filtering is needed here.
    prisma.presalesProject.findMany({
      where: { outcome: "OPEN", deletedAt: null, expectedCloseDate: { not: null } },
    }),
    // Once Won, these action items were already copied into the new
    // project's real ActionItem table (winPresalesProject) — reminding
    // about the presales-side rows again would be noise the delivery PM
    // can't act on from there. Once Lost, there's nothing left to chase.
    prisma.presalesActionItem.findMany({
      where: { status: { not: "Done" }, dueDate: { not: null }, presalesProject: { outcome: "OPEN", deletedAt: null } },
      include: { presalesProject: { select: { id: true, name: true } }, ownerPerson: { select: { name: true } } },
    }),
  ]);

  const checklistReminders = checklistItems
    .map((i) => ({ i, band: reminderBand(i.plannedDate, i.status === "COMPLETED" || i.status === "NOT_APPLICABLE") }))
    .filter((x): x is { i: (typeof checklistItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ i, band }) => ({
      href: `/projects/${i.project.id}/${i.type === "PM" ? "pm-checklist" : "devops-checklist"}`,
      contextLabel: i.project.name,
      projectId: i.project.id,
      source: "CHECKLIST" as const,
      context: i.stage,
      itemText: i.itemText,
      plannedDate: i.plannedDate as Date,
      band,
    }));

  const actionItemReminders = actionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done") }))
    .filter((x): x is { a: (typeof actionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      href: `/projects/${a.project.id}/action-items`,
      contextLabel: a.project.name,
      projectId: a.project.id,
      source: "ACTION_ITEM" as const,
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
    }));

  const presalesReminders = presalesOpportunities
    .map((o) => ({ o, band: reminderBand(o.expectedCloseDate, false) }))
    .filter((x): x is { o: (typeof presalesOpportunities)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ o, band }) => ({
      href: `/presales/${o.id}`,
      contextLabel: o.name,
      source: "PRESALES_OPPORTUNITY" as const,
      context: o.client ?? "No client set",
      itemText: "Expected close date",
      plannedDate: o.expectedCloseDate as Date,
      band,
    }));

  const presalesActionItemReminders = presalesActionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done") }))
    .filter((x): x is { a: (typeof presalesActionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      href: `/presales/${a.presalesProject.id}`,
      contextLabel: a.presalesProject.name,
      source: "PRESALES_ACTION_ITEM" as const,
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
    }));

  return [...checklistReminders, ...actionItemReminders, ...presalesReminders, ...presalesActionItemReminders].sort((a, b) => {
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
