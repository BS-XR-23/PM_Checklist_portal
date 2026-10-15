import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { isCurrentlyActive } from "@/lib/overload";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function MyEngagementPage() {
  const user = await requireUser();
  // Management (Program Manager) is deliberately excluded — a portfolio-wide
  // read role, not meant to be chasing its own personal staffing here.
  if (user.role === "PROGRAM_MANAGER") redirect("/projects");

  // Resolved by linked Person, not ProjectMembership — a resourcing-only
  // person (typically LIMITED) may have no membership row at all, and this
  // page must never leak anyone else's engagement regardless of role.
  const person = await prisma.person.findUnique({
    where: { userId: user.id },
    include: {
      engagements: { include: { project: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const current = (person?.engagements ?? []).filter((e) => isCurrentlyActive(e)).length;

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">My Engagement</h1>
        <p className="text-sm text-slate-500">The projects you&apos;re assigned to, your role on each, and the dates — nothing else.</p>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {!person ? (
          <p className="text-sm text-slate-500">
            Your account isn&apos;t linked to a Person record yet — ask an Admin to link it (Admin &gt; People) to see
            your engagement here.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              On <span className="font-semibold text-slate-900">{current}</span> project{current === 1 ? "" : "s"} right now.
            </p>

            <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {(person.engagements ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 text-slate-800 font-medium">{e.project.name}</td>
                      <td className="px-3 py-2 text-slate-600">{e.roleOnProject}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {e.startDate || e.endDate ? `${e.startDate ? formatDate(e.startDate) : "…"} – ${e.endDate ? formatDate(e.endDate) : "ongoing"}` : "No dates"}
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
