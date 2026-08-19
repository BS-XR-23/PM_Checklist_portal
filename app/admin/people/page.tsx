import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";
import { isCurrentlyActive, intensityForMonth } from "@/lib/overload";
import { startOfMonthUTC } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { IconUsers, IconUserCheck, IconFolder, IconDollar, IconBadge } from "@/components/layout/icons";
import { CreatePersonForm } from "./create-person-form";
import { PeopleDirectory } from "./people-directory";
import { ImportPeopleButton } from "./import-people-button";
import { CreateRoleRateForm } from "./create-role-rate-form";
import { RoleRateRow } from "./role-rate-row";
import { CreateCompetencyForm } from "./create-competency-form";
import { CompetencyRow } from "./competency-row";

export const dynamic = "force-dynamic";

function StatCard({
  icon,
  iconWrapClass,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  label: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
        <span className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-900 leading-tight">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

export default async function AdminPeoplePage() {
  const currentUser = await requireUser();
  if (!canManagePersonRegistry(currentUser.role)) redirect("/projects");

  const currentMonth = startOfMonthUTC(new Date());
  const [people, users, roleRates, competencies] = await Promise.all([
    prisma.person.findMany({
      orderBy: { name: "asc" },
      include: { user: true, roleRate: true, engagements: { include: { project: true, months: { where: { month: currentMonth } } } } },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.roleRate.findMany({ orderBy: { roleName: "asc" } }),
    prisma.competency.findMany({ orderBy: { level: "asc" } }),
  ]);

  const linkedUserIds = new Set(people.filter((p) => p.userId).map((p) => p.userId as string));
  const linkableUsers = users.filter((u) => !linkedUserIds.has(u.id));

  const rows = people.map((p) => {
    const active = p.engagements.filter((e) => isCurrentlyActive(e));
    // The dropdown offers every currently-unlinked account, plus this
    // person's own current link (which isn't in `linkableUsers` — it's
    // already linked, just to this row) so re-selecting "itself" works.
    const rowLinkableUsers = p.user ? [...linkableUsers, { id: p.user.id, name: p.user.name, email: p.user.email }] : linkableUsers;
    return {
      id: p.id,
      name: p.name,
      title: p.title,
      email: p.email,
      phone: p.phone,
      linkedUserId: p.userId,
      linkableUsers: rowLinkableUsers,
      roleRateId: p.roleRateId,
      competencyId: p.competencyId,
      // Structured, not pre-joined into a string — PersonRow renders each as
      // its own intensity-colored badge. One badge per line (not one long
      // joined string) for the same reason as before: someone staffed
      // across several projects was producing an unbroken line that forced
      // the whole table wider than the viewport.
      engagements: active.map((e) => ({
        projectName: e.project.name,
        roleOnProject: e.roleOnProject,
        intensityPct: intensityForMonth(e.months, currentMonth),
      })),
    };
  });

  const totalPeople = people.length;
  const onProject = rows.filter((r) => r.engagements.length > 0).length;
  const linkedAccountCount = linkedUserIds.size;
  const avgRate = roleRates.length > 0 ? roleRates.reduce((sum, r) => sum + r.manDayRate, 0) / roleRates.length : 0;

  const statCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard icon={<IconUsers />} iconWrapClass="bg-blue-50 text-blue-600" label="Total People" value={totalPeople} subtitle="All team members" />
      <StatCard
        icon={<IconUserCheck />}
        iconWrapClass="bg-emerald-50 text-emerald-600"
        label="On Project"
        value={onProject}
        subtitle="Currently engaged"
      />
      <StatCard
        icon={<IconFolder />}
        iconWrapClass="bg-violet-50 text-violet-600"
        label="Linked Accounts"
        value={linkedAccountCount}
        subtitle="Have a portal login"
      />
      <StatCard
        icon={<IconDollar />}
        iconWrapClass="bg-amber-50 text-amber-600"
        label="Avg. Rate"
        value={`$${avgRate.toFixed(1)}`}
        subtitle="Average man-day rate"
      />
    </div>
  );

  const sidebarBottom = (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <IconDollar className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Role Rates</h3>
        </div>
        <p className="text-xs text-slate-500">Rates are set by role, not by named person.</p>
        <CreateRoleRateForm />
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-semibold text-slate-500 bg-slate-50">
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 w-24 whitespace-nowrap">Rate</th>
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {roleRates.map((r) => (
                <RoleRateRow key={r.id} roleRate={r} />
              ))}
            </tbody>
          </table>
          {roleRates.length === 0 && <p className="text-xs text-slate-400 p-3">No role rates set yet.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <IconBadge className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Competencies</h3>
        </div>
        <p className="text-xs text-slate-500">Velocity/capacity multipliers used in Sprint Summary.</p>
        <CreateCompetencyForm />
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-semibold text-slate-500 bg-slate-50">
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Multiplier</th>
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {competencies.map((c) => (
                <CompetencyRow key={c.id} competency={c} />
              ))}
            </tbody>
          </table>
          {competencies.length === 0 && <p className="text-xs text-slate-400 p-3">No competencies set yet.</p>}
        </div>
      </div>
    </>
  );

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">People & Resources</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage team members, roles, rates and competencies used for project planning and resource tracking.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ImportPeopleButton />
          <a
            href="#add-person"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
          >
            + Add Person
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <PeopleDirectory
          statCards={statCards}
          addPersonForm={<CreatePersonForm linkableUsers={linkableUsers} roleRates={roleRates} competencies={competencies} />}
          rows={rows}
          roleRates={roleRates}
          competencies={competencies}
          sidebarBottom={sidebarBottom}
        />
      </main>
    </AppShell>
  );
}
