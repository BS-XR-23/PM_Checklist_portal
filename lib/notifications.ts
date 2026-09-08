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

const DAY_MS = 86400000;

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
  groupId: string; // groups reminders for the "grouped by project" view — a real project id, or the presales opportunity's id when there's no project
  projectId?: string; // present for CHECKLIST/ACTION_ITEM only — a presales reminder isn't scoped to a project
  source: "CHECKLIST" | "ACTION_ITEM" | "PRESALES_OPPORTUNITY" | "PRESALES_ACTION_ITEM";
  context: string; // stage / owner / client — the subtitle's first segment
  itemText: string;
  plannedDate: Date;
  band: "OVERDUE" | "DUE_SOON";
  // None of the source models (ChecklistItem/ActionItem/PresalesActionItem/
  // PresalesProject) carry a real priority field, so this is derived purely
  // from urgency: how overdue, or how soon, the planned date is.
  priority: "Low" | "Medium" | "High";
};

function reminderPriority(band: "OVERDUE" | "DUE_SOON", plannedDate: Date, today: Date): ReminderItem["priority"] {
  const diffDays = Math.floor((plannedDate.getTime() - today.getTime()) / DAY_MS);
  if (band === "OVERDUE") return diffDays <= -7 ? "High" : "Medium";
  return diffDays <= 2 ? "Medium" : "Low";
}

type ReminderSource = {
  checklistItems: Awaited<ReturnType<typeof fetchChecklistItems>>;
  actionItems: Awaited<ReturnType<typeof fetchActionItems>>;
  presalesOpportunities: Awaited<ReturnType<typeof fetchPresalesOpportunities>>;
  presalesActionItems: Awaited<ReturnType<typeof fetchPresalesActionItems>>;
};

function fetchChecklistItems(projectIds: string[]) {
  return projectIds.length === 0
    ? Promise.resolve([])
    : prisma.checklistItem.findMany({
        where: { projectId: { in: projectIds }, status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] }, plannedDate: { not: null } },
        include: { project: { select: { id: true, name: true } } },
      });
}

function fetchActionItems(projectIds: string[]) {
  return projectIds.length === 0
    ? Promise.resolve([])
    : prisma.actionItem.findMany({
        where: { projectId: { in: projectIds }, status: { not: "Done" }, dueDate: { not: null } },
        include: { project: { select: { id: true, name: true } }, ownerPerson: { select: { name: true } } },
      });
}

function fetchPresalesOpportunities() {
  // Presales isn't project-scoped (no membership concept — any of these
  // roles already sees every opportunity via app/presales/page.tsx), so no
  // visibleActiveProjectIds-style filtering is needed here.
  return prisma.presalesProject.findMany({
    where: { outcome: "OPEN", deletedAt: null, expectedCloseDate: { not: null } },
  });
}

function fetchPresalesActionItems() {
  // Once Won, these action items were already copied into the new project's
  // real ActionItem table (winPresalesProject) — reminding about the
  // presales-side rows again would be noise the delivery PM can't act on
  // from there. Once Lost, there's nothing left to chase.
  return prisma.presalesActionItem.findMany({
    where: { status: { not: "Done" }, dueDate: { not: null }, presalesProject: { outcome: "OPEN", deletedAt: null } },
    include: { presalesProject: { select: { id: true, name: true } }, ownerPerson: { select: { name: true } } },
  });
}

async function fetchReminderSource(user: CurrentUser): Promise<ReminderSource> {
  if (!REMINDER_ROLES.includes(user.role)) {
    return { checklistItems: [], actionItems: [], presalesOpportunities: [], presalesActionItems: [] };
  }
  const projectIds = await visibleActiveProjectIds(user);
  const [checklistItems, actionItems, presalesOpportunities, presalesActionItems] = await Promise.all([
    fetchChecklistItems(projectIds),
    fetchActionItems(projectIds),
    fetchPresalesOpportunities(),
    fetchPresalesActionItems(),
  ]);
  return { checklistItems, actionItems, presalesOpportunities, presalesActionItems };
}

function buildReminders(source: ReminderSource, today: Date): ReminderItem[] {
  const checklistReminders = source.checklistItems
    .map((i) => ({ i, band: reminderBand(i.plannedDate, i.status === "COMPLETED" || i.status === "NOT_APPLICABLE", today) }))
    .filter((x): x is { i: (typeof source.checklistItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ i, band }) => ({
      href: `/projects/${i.project.id}/${i.type === "PM" ? "pm-checklist" : "devops-checklist"}`,
      contextLabel: i.project.name,
      groupId: i.project.id,
      projectId: i.project.id,
      source: "CHECKLIST" as const,
      context: i.stage,
      itemText: i.itemText,
      plannedDate: i.plannedDate as Date,
      band,
      priority: reminderPriority(band, i.plannedDate as Date, today),
    }));

  const actionItemReminders = source.actionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done", today) }))
    .filter((x): x is { a: (typeof source.actionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      href: `/projects/${a.project.id}/action-items`,
      contextLabel: a.project.name,
      groupId: a.project.id,
      projectId: a.project.id,
      source: "ACTION_ITEM" as const,
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
      priority: reminderPriority(band, a.dueDate as Date, today),
    }));

  const presalesReminders = source.presalesOpportunities
    .map((o) => ({ o, band: reminderBand(o.expectedCloseDate, false, today) }))
    .filter((x): x is { o: (typeof source.presalesOpportunities)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ o, band }) => ({
      href: `/presales/${o.id}`,
      contextLabel: o.name,
      groupId: o.id,
      source: "PRESALES_OPPORTUNITY" as const,
      context: o.client ?? "No client set",
      itemText: "Expected close date",
      plannedDate: o.expectedCloseDate as Date,
      band,
      priority: reminderPriority(band, o.expectedCloseDate as Date, today),
    }));

  const presalesActionItemReminders = source.presalesActionItems
    .map((a) => ({ a, band: reminderBand(a.dueDate, a.status === "Done", today) }))
    .filter((x): x is { a: (typeof source.presalesActionItems)[number]; band: "OVERDUE" | "DUE_SOON" } => x.band !== null)
    .map(({ a, band }) => ({
      href: `/presales/${a.presalesProject.id}`,
      contextLabel: a.presalesProject.name,
      groupId: a.presalesProject.id,
      source: "PRESALES_ACTION_ITEM" as const,
      context: a.ownerPerson?.name ?? a.owner ?? "Unassigned",
      itemText: a.description,
      plannedDate: a.dueDate as Date,
      band,
      priority: reminderPriority(band, a.dueDate as Date, today),
    }));

  return [...checklistReminders, ...actionItemReminders, ...presalesReminders, ...presalesActionItemReminders].sort((a, b) => {
    if (a.band !== b.band) return a.band === "OVERDUE" ? -1 : 1;
    return a.plannedDate.getTime() - b.plannedDate.getTime();
  });
}

async function reminderItemsRaw(user: CurrentUser): Promise<ReminderItem[]> {
  const source = await fetchReminderSource(user);
  return buildReminders(source, new Date());
}

export async function getReminderCount(user: CurrentUser): Promise<number> {
  const items = await reminderItemsRaw(user);
  return items.length;
}

export async function getReminderItems(user: CurrentUser): Promise<ReminderItem[]> {
  return reminderItemsRaw(user);
}

export type ReminderTrend = {
  totalDelta: number;
  overdueDelta: number;
  dueSoonDelta: number;
  projectsAffectedDelta: number;
};

// "Since last week" deltas for the Reminders page stat cards. There's no
// history table for this, so it's approximated by recomputing bands against
// the *current* set of still-open items with the reference date shifted back
// 7 days — valid since planned/due dates don't change after the fact. The
// one gap: an item completed or deleted within the last week is excluded
// from the current fetch entirely, so it can't contribute to either side of
// the delta even though it may genuinely have been overdue/due-soon a week
// ago. That undercounts last week's totals slightly rather than over-counts,
// which is the safer direction for a "how are we trending" indicator.
export async function getReminderTrend(user: CurrentUser): Promise<ReminderTrend> {
  const source = await fetchReminderSource(user);
  const now = buildReminders(source, new Date());
  const weekAgo = buildReminders(source, new Date(Date.now() - 7 * DAY_MS));

  const count = (items: ReminderItem[], band: ReminderItem["band"]) => items.filter((r) => r.band === band).length;
  const projectsAffected = (items: ReminderItem[]) => new Set(items.map((r) => r.groupId)).size;

  return {
    totalDelta: now.length - weekAgo.length,
    overdueDelta: count(now, "OVERDUE") - count(weekAgo, "OVERDUE"),
    dueSoonDelta: count(now, "DUE_SOON") - count(weekAgo, "DUE_SOON"),
    projectsAffectedDelta: projectsAffected(now) - projectsAffected(weekAgo),
  };
}
