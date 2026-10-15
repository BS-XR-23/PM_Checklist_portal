import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { toDateInputValue } from "@/lib/format";
import { SubNav } from "@/components/ui/sub-nav";
import { AddToRosterForm } from "./add-to-roster-form";
import { RosterList, type RosterRow } from "./roster-list";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * The project's team roster — who works on it, in what role, and when. A
 * reference list, not a capacity plan (no intensity/allocation). It is also
 * the pool the Delivery tab's task and sprint assignee pickers draw from.
 */
export default async function ResourcingPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);
  if (!canViewResourcing(user.role)) redirect(`/projects/${params.projectId}/dashboard`);

  const canSeeTeamTab = user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER" || user.role === "PM";
  const subNavOptions = [
    ...(canSeeTeamTab ? [{ href: "/team", label: "Access" }] : []),
    { href: "/resourcing", label: "Engagement" },
  ];

  const membership =
    user.role === "PM"
      ? await prisma.projectMembership.findUnique({ where: { userId_projectId: { userId: user.id, projectId: params.projectId } } })
      : null;
  const canEdit = user.role === "ADMIN" || (user.role === "PM" && membership?.role === "PM");

  const [engagements, allPeople, roleTitles] = await Promise.all([
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: { select: { name: true, title: true } } },
      orderBy: { person: { name: "asc" } },
    }),
    canEdit ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true } }) : Promise.resolve([]),
    // Titles already in use across the People registry, offered as the role
    // picker so role names stay consistent instead of free-typed variants.
    canEdit
      ? prisma.person.findMany({ where: { title: { not: null } }, distinct: ["title"], select: { title: true }, orderBy: { title: "asc" } })
      : Promise.resolve([]),
  ]);
  const roleOptions = roleTitles.map((p) => p.title as string);
  const onProject = new Set(engagements.map((e) => e.personId));
  const addable = allPeople.filter((p) => !onProject.has(p.id));

  // Dates are stored at local midnight, so compare against the start of
  // today: someone whose end date is today is still on the project today.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rows: RosterRow[] = engagements.map((e) => {
    const status: RosterRow["status"] = e.endDate && e.endDate < today ? "ended" : e.startDate && e.startDate > now ? "upcoming" : "current";
    const daysLeft = e.endDate ? Math.round((e.endDate.getTime() - today.getTime()) / DAY_MS) : null;
    return {
      id: e.id,
      personName: e.person.name,
      roleOnProject: e.roleOnProject,
      startDate: toDateInputValue(e.startDate),
      endDate: toDateInputValue(e.endDate),
      status,
      endsInDays: status === "current" && daysLeft != null && daysLeft <= 7 ? daysLeft : null,
    };
  });

  return (
    <div className="space-y-5">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Who&apos;s on this project</h2>
        <p className="text-sm text-slate-500">
          A reference list of the people working on this project and their role. Only people listed here can be picked as assignees on
          Delivery&apos;s Tasks and Sprints. New people are added to the registry at Admin › People.
        </p>
      </div>

      {canEdit && <AddToRosterForm projectId={params.projectId} people={addable} roleOptions={roleOptions} />}

      <RosterList projectId={params.projectId} rows={rows} canEdit={canEdit} roleOptions={roleOptions} />
    </div>
  );
}
