import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { computePersonLoad, findOverlapConflicts, isCurrentlyActive, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { toDateInputValue, parseMonthParam, toMonthParam, addMonthsUTC, formatMonthLabel } from "@/lib/format";
import { SubNav } from "@/components/ui/sub-nav";
import { AssignEngagementForm } from "./assign-engagement-form";
import { EngagementRow, type EngagementRowData } from "./engagement-row";

export const dynamic = "force-dynamic";

export default async function ResourcingPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { month?: string };
}) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);
  const targetMonth = parseMonthParam(searchParams.month);

  if (!canViewResourcing(user.role)) redirect(`/projects/${params.projectId}/dashboard`);

  const canSeeTeamTab = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";
  const subNavOptions = [
    ...(canSeeTeamTab ? [{ href: "/team", label: "Access" }] : []),
    { href: "/resourcing", label: "Engagement" },
  ];

  const membership =
    user.role === "PM"
      ? await prisma.projectMembership.findUnique({ where: { userId_projectId: { userId: user.id, projectId: params.projectId } } })
      : null;
  const canEdit = user.role === "ADMIN" || (user.role === "PM" && membership?.role === "PM");

  const [engagements, allPeople] = await Promise.all([
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: true, months: { where: { month: targetMonth } } },
      orderBy: { createdAt: "asc" },
    }),
    canEdit ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true } }) : Promise.resolve([]),
  ]);

  // For the conflict view, pull EVERY engagement (any project) for the people
  // on this roster — the whole point of the signal is spotting a shared
  // resource stretched across a project this viewer can't otherwise see.
  const personIds = Array.from(new Set(engagements.map((e) => e.personId)));
  const allEngagementsForThesePeople =
    personIds.length > 0
      ? await prisma.projectEngagement.findMany({
          where: { personId: { in: personIds } },
          include: { project: true, months: { where: { month: targetMonth } } },
        })
      : [];

  const rows: EngagementRowData[] = engagements.map((e) => {
    const forThisPerson = allEngagementsForThesePeople.filter((x) => x.personId === e.personId);
    const asEngagementLike: EngagementLike[] = forThisPerson.map((x) => ({
      id: x.id,
      projectId: x.projectId,
      projectName: x.project.name,
      roleOnProject: x.roleOnProject,
      intensityPct: intensityForMonth(x.months, targetMonth),
      startDate: x.startDate,
      endDate: x.endDate,
    }));
    // Signals reflect the month currently being viewed, not always "today"
    // — you're editing this month's intensity, so you want this month's
    // overload/conflict picture.
    const load = computePersonLoad(asEngagementLike, targetMonth);
    const conflicts = findOverlapConflicts(asEngagementLike).filter((c) => c.a.id === e.id || c.b.id === e.id);

    return {
      id: e.id,
      personName: e.person.name,
      personTitle: e.person.title,
      roleOnProject: e.roleOnProject,
      intensityPct: intensityForMonth(e.months, targetMonth),
      inBounds: isCurrentlyActive({ startDate: e.startDate, endDate: e.endDate }, targetMonth),
      startDate: toDateInputValue(e.startDate),
      endDate: toDateInputValue(e.endDate),
      totalActivePct: load.totalActivePct,
      isOverloaded: load.isOverloaded,
      overlaps: conflicts.map((c) => {
        const other = c.a.id === e.id ? c.b : c.a;
        return {
          otherProjectName: other.projectName,
          otherRole: other.roleOnProject,
          otherIntensityPct: other.intensityPct,
          start: toDateInputValue(other.startDate),
          end: toDateInputValue(other.endDate),
        };
      }),
    };
  });

  return (
    <div className="space-y-6">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Resourcing</h2>
        <p className="text-sm text-slate-500">
          Who&apos;s engaged on this project, their role, and how stretched they are — not a scheduling tool, just
          enough to reason about workload. Intensity is tracked month by month; use ◂ ▸ below to move between
          months. Assigning a brand-new person to the registry happens at Admin &gt; People.
        </p>
      </div>

      {canEdit && <AssignEngagementForm projectId={params.projectId} people={allPeople} />}

      <div className="flex items-center justify-center gap-3">
        <Link
          href={`?month=${toMonthParam(addMonthsUTC(targetMonth, -1))}`}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          ◂
        </Link>
        <span className="text-sm font-semibold text-slate-800 min-w-[10rem] text-center">{formatMonthLabel(targetMonth)}</span>
        <Link
          href={`?month=${toMonthParam(addMonthsUTC(targetMonth, 1))}`}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          ▸
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium w-24">Intensity</th>
              <th className="px-3 py-2 font-medium w-36">Start</th>
              <th className="px-3 py-2 font-medium w-36">End</th>
              <th className="px-3 py-2 font-medium">Signals</th>
              {canEdit && <th className="px-3 py-2 font-medium w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <EngagementRow key={r.id} projectId={params.projectId} month={toMonthParam(targetMonth)} engagement={r} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No one assigned to this project yet.</p>}
      </div>
    </div>
  );
}
