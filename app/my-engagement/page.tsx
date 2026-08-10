import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { computePersonLoad, intensityForMonth, type EngagementLike } from "@/lib/overload";
import { formatDate, startOfMonthUTC } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function MyEngagementPage() {
  const user = await requireUser();
  const currentMonth = startOfMonthUTC(new Date());

  // Resolved by linked Person, not ProjectMembership — a resourcing-only
  // person (typically LIMITED) may have no membership row at all, and this
  // page must never leak anyone else's engagement regardless of role.
  const person = await prisma.person.findUnique({
    where: { userId: user.id },
    include: {
      engagements: { include: { project: true, months: { where: { month: currentMonth } } }, orderBy: { createdAt: "asc" } },
    },
  });

  const engagements: EngagementLike[] = (person?.engagements ?? []).map((e) => ({
    id: e.id,
    projectId: e.projectId,
    projectName: e.project.name,
    roleOnProject: e.roleOnProject,
    intensityPct: intensityForMonth(e.months, currentMonth),
    startDate: e.startDate,
    endDate: e.endDate,
  }));
  const load = computePersonLoad(engagements);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">My Engagement</h1>
        <p className="text-sm text-slate-500">Your own project assignments, role, and current allocation — nothing else.</p>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {!person ? (
          <p className="text-sm text-slate-500">
            Your account isn&apos;t linked to a Person record yet — ask an Admin to link it (Admin &gt; People) to see
            your engagement here.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Total current-month allocation</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{load.totalActivePct}%</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium w-32">Intensity (this month)</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {(person.engagements ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 text-slate-800 font-medium">{e.project.name}</td>
                      <td className="px-3 py-2 text-slate-600">{e.roleOnProject}</td>
                      <td className="px-3 py-2 text-slate-600">{intensityForMonth(e.months, currentMonth)}%</td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatDate(e.startDate)} – {formatDate(e.endDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(person.engagements ?? []).length === 0 && (
                <p className="text-sm text-slate-400 p-4">You&apos;re not currently assigned to any project.</p>
              )}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
