import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";
import { isCurrentlyActive } from "@/lib/overload";
import { AppShell } from "@/components/layout/app-shell";
import { CreatePersonForm } from "./create-person-form";
import { PersonRow } from "./person-row";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const currentUser = await requireUser();
  if (!canManagePersonRegistry(currentUser.role)) redirect("/projects");

  const [people, users] = await Promise.all([
    prisma.person.findMany({
      orderBy: { name: "asc" },
      include: { user: true, engagements: { include: { project: true } } },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const linkedUserIds = new Set(people.filter((p) => p.userId).map((p) => p.userId as string));
  const linkableUsers = users.filter((u) => !linkedUserIds.has(u.id));

  const rows = people.map((p) => {
    const active = p.engagements.filter((e) => isCurrentlyActive(e));
    return {
      id: p.id,
      name: p.name,
      title: p.title,
      email: p.email,
      phone: p.phone,
      linkedUserLabel: p.user ? `${p.user.name} (${p.user.email})` : null,
      engagementSummary: active.map((e) => `${e.project.name} — ${e.roleOnProject} (${e.intensityPct}%)`).join("; "),
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
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Portal Account</th>
                <th className="px-3 py-2 font-medium">Current Engagements</th>
                <th className="px-3 py-2 font-medium w-8" />
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
      </main>
    </AppShell>
  );
}
