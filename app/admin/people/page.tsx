import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canManagePersonRegistry, canViewPersonRegistry } from "@/lib/resourcing-rbac";
import { isCurrentlyActive, intensityForMonth } from "@/lib/overload";
import { startOfMonthUTC } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { IconUsers, IconUserCheck, IconFolder, IconDollar, IconBadge } from "@/components/layout/icons";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { CreatePersonForm } from "./create-person-form";
import { PeopleDirectory } from "./people-directory";
import { ImportPeopleButton } from "./import-people-button";
import { CreateRoleRateForm } from "./create-role-rate-form";
import { RoleRateRow } from "./role-rate-row";
import { CreateCompetencyForm } from "./create-competency-form";
import { CompetencyRow } from "./competency-row";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const currentUser = await requireUser();
  if (!canViewPersonRegistry(currentUser.role)) redirect("/projects");
  // Admin (TPM), Management (Program Manager), and PM can view this
  // registry read-only — rate/competency numbers hidden — but only Super
  // Admin can actually edit it.
  const canEdit = canManagePersonRegistry(currentUser.role);

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile icon={<IconUsers />} iconWrapClass="bg-blue-50 text-blue-600" label="Total People" value={String(totalPeople)} subtitle="All team members" />
      <StatTile
        icon={<IconUserCheck />}
        iconWrapClass="bg-emerald-50 text-emerald-600"
        label="On Project"
        value={String(onProject)}
        subtitle="Currently engaged"
      />
      <StatTile
        icon={<IconFolder />}
        iconWrapClass="bg-violet-50 text-violet-600"
        label="Linked Accounts"
        value={String(linkedAccountCount)}
        subtitle="Have a portal login"
      />
      {canEdit && (
        <StatTile
          icon={<IconDollar />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Avg. Rate"
          value={`$${avgRate.toFixed(1)}`}
          subtitle="Avg. man-day rate"
        />
      )}
    </div>
  );

  const sidebarBottom = (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <SectionHeader icon={<IconDollar />} iconWrapClass="bg-amber-50 text-amber-600" title="Role Rates" className="" />
        <p className="text-xs text-slate-500">
          Rates are set by role, not by named person.{!canEdit && " Only Super Admin can see the actual $ figures."}
        </p>
        {canEdit && <CreateRoleRateForm />}
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="text-left font-semibold text-slate-500 bg-slate-50">
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 w-16 whitespace-nowrap">Rate</th>
                {canEdit && <th className="px-3 py-2 w-6" />}
              </tr>
            </thead>
            <tbody>
              {roleRates.map((r) => (
                <RoleRateRow key={r.id} roleRate={r} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
          {roleRates.length === 0 && <p className="text-xs text-slate-400 p-3">No role rates set yet.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <SectionHeader icon={<IconBadge />} iconWrapClass="bg-violet-50 text-violet-600" title="Competencies" className="" />
        <p className="text-xs text-slate-500">
          Velocity/capacity multipliers used in Sprint Summary.{!canEdit && " Only Super Admin can see the actual multipliers."}
        </p>
        {canEdit && <CreateCompetencyForm />}
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="text-left font-semibold text-slate-500 bg-slate-50">
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2 w-20 whitespace-nowrap">Multiplier</th>
                {canEdit && <th className="px-3 py-2 w-6" />}
              </tr>
            </thead>
            <tbody>
              {competencies.map((c) => (
                <CompetencyRow key={c.id} competency={c} canEdit={canEdit} />
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
            {canEdit
              ? "Manage team members, roles, rates and competencies used for project planning and resource tracking."
              : "Team members and their staffing — rate and competency figures are visible to Super Admin only."}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2.5">
            <ImportPeopleButton />
            <a
              href="#add-person"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
            >
              + Add Person
            </a>
          </div>
        )}
      </header>
      <main className="p-4 sm:p-6">
        <PeopleDirectory
          statCards={statCards}
          addPersonForm={canEdit ? <CreatePersonForm linkableUsers={linkableUsers} roleRates={roleRates} competencies={competencies} /> : null}
          rows={rows}
          roleRates={roleRates}
          competencies={competencies}
          sidebarBottom={sidebarBottom}
          canEdit={canEdit}
        />
      </main>
    </AppShell>
  );
}
