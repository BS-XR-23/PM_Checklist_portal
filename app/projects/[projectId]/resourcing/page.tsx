import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { computePersonLoad, findOverlapConflicts, isActiveDuringMonth, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { toDateInputValue, parseMonthParam, toMonthParam, addMonthsUTC, formatMonthShortLabel } from "@/lib/format";
import { INTENSITY_BAND_COLORS } from "@/lib/colors";
import { SubNav } from "@/components/ui/sub-nav";
import { IconInfo, IconHeart, IconGauge, IconAlertCircle, IconClock, IconUserPlus } from "@/components/layout/icons";
import { AssignEngagementForm } from "./assign-engagement-form";
import { EngagementRow, type EngagementRowData } from "./engagement-row";

// Window of months shown in the timeline strip, centered on the currently
// viewed month — ‹ / › just step targetMonth by one, which slides the whole
// centered window with it (same link every chip already uses).
const STRIP_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

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

  // For the conflict view, each row also needs EVERY engagement (any
  // project) for that same person — the whole point of the signal is
  // spotting a shared resource stretched across a project this viewer can't
  // otherwise see. Pulled via a nested include on `person.engagements`
  // rather than a second findMany keyed off the first query's personIds —
  // one round trip instead of two serialized ones.
  const [engagements, allPeople, roleTitles] = await Promise.all([
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: {
        person: { include: { engagements: { include: { project: true, months: { where: { month: targetMonth } } } } } },
        months: { where: { month: targetMonth } },
      },
      orderBy: { createdAt: "asc" },
    }),
    canEdit ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true } }) : Promise.resolve([]),
    // Distinct titles already in use across the People registry — offered as
    // the "Role on this project" picker so role names stay consistent
    // instead of every PM typing a slightly different spelling.
    canEdit
      ? prisma.person.findMany({ where: { title: { not: null } }, distinct: ["title"], select: { title: true }, orderBy: { title: "asc" } })
      : Promise.resolve([]),
  ]);
  const roleOptions = roleTitles.map((p) => p.title as string);

  // Real wall-clock "soon", independent of the month being browsed — an
  // engagement ending in the next week is urgent to know about whether
  // you're looking at this month or scrolled off to another one.
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const rows: EngagementRowData[] = engagements.map((e) => {
    const asEngagementLike: EngagementLike[] = e.person.engagements.map((x) => ({
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
      inBounds: isActiveDuringMonth({ startDate: e.startDate, endDate: e.endDate }, targetMonth),
      startDate: toDateInputValue(e.startDate),
      endDate: toDateInputValue(e.endDate),
      totalActivePct: load.totalActivePct,
      isOverloaded: load.isOverloaded,
      endingSoon: !!e.endDate && e.endDate >= now && e.endDate <= in7Days,
      newToProject: e.createdAt.getUTCFullYear() === targetMonth.getUTCFullYear() && e.createdAt.getUTCMonth() === targetMonth.getUTCMonth(),
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
        <h2 className="text-base font-semibold text-slate-900">Team Engagement</h2>
        <p className="text-sm text-slate-500">
          Track who&apos;s engaged, their role, and how stretched they are. Intensity shows workload level as a % of
          full capacity.
        </p>
        <p className="text-sm text-slate-500">
          Use the timeline below to move between months. Assigning a brand-new person to the registry happens at
          Admin &gt; People.
        </p>
      </div>

      {canEdit && <AssignEngagementForm projectId={params.projectId} people={allPeople} roleOptions={roleOptions} />}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`?month=${toMonthParam(addMonthsUTC(targetMonth, -1))}`}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 shrink-0"
            aria-label="Earlier months"
          >
            ‹
          </Link>
          <div className="flex-1 grid grid-cols-7 gap-2">
            {STRIP_OFFSETS.map((offset) => {
              const m = addMonthsUTC(targetMonth, offset);
              const isCurrent = offset === 0;
              return (
                <Link
                  key={offset}
                  href={`?month=${toMonthParam(m)}`}
                  className={
                    isCurrent
                      ? "rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-center text-sm font-semibold text-indigo-700"
                      : "rounded-lg border border-slate-200 px-3 py-1.5 text-center text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }
                >
                  {formatMonthShortLabel(m)}
                </Link>
              );
            })}
          </div>
          <Link
            href={`?month=${toMonthParam(addMonthsUTC(targetMonth, 1))}`}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 shrink-0"
            aria-label="Later months"
          >
            ›
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Utilization guide</span>
          {(["low", "medium", "high"] as const).map((band) => (
            <span key={band} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: INTENSITY_BAND_COLORS[band].text }} />
              {INTENSITY_BAND_COLORS[band].label} {band === "low" ? "0–39%" : band === "medium" ? "40–59%" : "60%+"}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Role on Project</th>
              <th className="px-3 py-2 font-medium w-40">Intensity ({formatMonthShortLabel(targetMonth)})</th>
              <th className="px-3 py-2 font-medium w-36">Start</th>
              <th className="px-3 py-2 font-medium w-36">End</th>
              <th className="px-3 py-2 font-medium">Signals</th>
              {canEdit && <th className="px-3 py-2 font-medium w-10">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <EngagementRow
                key={`${r.id}-${toMonthParam(targetMonth)}`}
                projectId={params.projectId}
                month={toMonthParam(targetMonth)}
                engagement={r}
                canEdit={canEdit}
                roleOptions={roleOptions}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No one assigned to this project yet.</p>}

        {rows.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Signals</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <SignalLegendItem icon={<IconHeart />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Healthy" hint="Utilization < 70%" />
              <SignalLegendItem icon={<IconGauge />} iconWrapClass="bg-amber-50 text-amber-600" label="High Utilization" hint="Utilization 70–100%" />
              <SignalLegendItem icon={<IconAlertCircle />} iconWrapClass="bg-rose-50 text-rose-600" label="Over Utilized" hint="Utilization > 100%" />
              <SignalLegendItem icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" label="Ending Soon" hint="Ends in next 7 days" />
              <SignalLegendItem icon={<IconUserPlus />} iconWrapClass="bg-violet-50 text-violet-600" label="New to Project" hint="Assigned in this month" />
            </div>
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <IconInfo className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Intensity is relative to a person&apos;s total capacity and includes confirmed allocations from other
        projects.
      </p>
    </div>
  );
}

function SignalLegendItem({ icon, iconWrapClass, label, hint }: { icon: React.ReactNode; iconWrapClass: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}
