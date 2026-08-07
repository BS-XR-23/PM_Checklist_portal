import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";
import { isCurrentlyActive } from "@/lib/overload";
import { AppShell } from "@/components/layout/app-shell";
import { CreatePersonForm } from "./create-person-form";
import { PersonRow } from "./person-row";
import { CreateRoleRateForm } from "./create-role-rate-form";
import { RoleRateRow } from "./role-rate-row";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const currentUser = await requireUser();
  if (!canManagePersonRegistry(currentUser.role)) redirect("/projects");

  const [people, users, roleRates] = await Promise.all([
    prisma.person.findMany({
      orderBy: { name: "asc" },
      include: { user: true, engagements: { include: { project: true } } },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.roleRate.findMany({ orderBy: { roleName: "asc" } }),
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
      // Structured, not pre-joined into a string — PersonRow renders each as
      // its own intensity-colored badge. One badge per line (not one long
      // joined string) for the same reason as before: someone staffed
      // across several projects was producing an unbroken line that forced
      // the whole table wider than the viewport.
      engagements: active.map((e) => ({ projectName: e.project.name, roleOnProject: e.roleOnProject, intensityPct: e.intensityPct })),
    };
  });

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">People</h1>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <CreatePersonForm linkableUsers={linkableUsers} />

        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Portal Account</th>
                <th className="px-4 py-3 font-medium">Current Engagements</th>
                <th className="px-4 py-3 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No people in the registry yet.</p>}
        </div>
        <p className="text-xs text-slate-400">
          Assigning a Person to a specific project (role, intensity, dates) happens on that project&apos;s
          Resourcing tab — Admin or that project&apos;s PM.
        </p>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Role Rates</h2>
          <p className="text-sm text-slate-500 mb-4">
            Used to auto-compute Actual Cost on each project&apos;s Budget Tracker from man-days logged per role
            each week — rates are set by role, not by named person.
          </p>
          <CreateRoleRateForm />
          <div className="mt-4 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Man-Day Rate</th>
                  <th className="px-4 py-3 font-medium w-8" />
                </tr>
              </thead>
              <tbody>
                {roleRates.map((r) => (
                  <RoleRateRow key={r.id} roleRate={r} />
                ))}
              </tbody>
            </table>
            {roleRates.length === 0 && <p className="text-sm text-slate-400 p-4">No role rates set yet.</p>}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
