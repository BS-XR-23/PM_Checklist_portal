import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { SubNav } from "@/components/ui/sub-nav";

export const dynamic = "force-dynamic";

/**
 * A single at-a-glance view of every task's sprint assignment across the
 * whole project — read-only, no editing surfaces of its own. Answers "what
 * lands where" without opening each sprint's popup one at a time. Reflects
 * live WbsTask state (current sprintId/pctComplete), not a closed sprint's
 * frozen snapshot — this is "what's true right now," which is what closed
 * sprints' own frozen* fields already aren't (those are the permanent
 * historical record, shown in the Sprint panel's own drill-down instead).
 */
export default async function DeliveryRoadmapPage({ params }: { params: { projectId: string } }) {
  await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");

  const [tasks, sprints] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId: params.projectId }, orderBy: { wbsNumber: "asc" } }),
    prisma.sprint.findMany({ where: { projectId: params.projectId }, orderBy: { startDate: "asc" } }),
  ]);

  const groups = [
    ...sprints.map((s) => ({
      key: s.id,
      label: s.name,
      dateRange: `${formatDate(s.startDate)} – ${formatDate(s.endDate)}`,
      closed: !!s.closedAt,
      tasks: tasks.filter((t) => t.sprintId === s.id),
    })),
    {
      key: "backlog",
      label: "Backlog",
      dateRange: "Not yet committed to a sprint",
      closed: false,
      tasks: tasks.filter((t) => !t.sprintId),
    },
  ].filter((g) => g.key !== "backlog" || g.tasks.length > 0);

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Sprints" },
          { href: "/delivery/tasks", label: "Tasks" },
          { href: "/delivery/roadmap", label: "Roadmap" },
        ]}
      />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Roadmap</h2>
        <p className="text-sm text-slate-500">
          Every task&apos;s current sprint assignment, at a glance. Read-only — edit progress on the Sprints tab, or
          a task&apos;s definition on the Tasks tab.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
          No sprints yet — create one on the Sprints tab.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const totalPts = g.tasks.reduce((sum, t) => sum + t.storyPoints, 0);
            return (
              <div key={g.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        g.key === "backlog" ? "bg-slate-300" : g.closed ? "bg-slate-400" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-sm font-semibold text-slate-800">{g.label}</span>
                    <span className="text-xs text-slate-400">{g.dateRange}</span>
                    {g.key !== "backlog" &&
                      (g.closed ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Open
                        </span>
                      ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{totalPts} pts</span>
                </div>

                {g.tasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No tasks committed to this sprint yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60">
                      <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="py-2 px-4 w-24">WBS#</th>
                        <th className="py-2 px-4">Title</th>
                        <th className="py-2 px-4 w-24">Story Pts</th>
                        <th className="py-2 px-4 w-44">Assignee</th>
                        <th className="py-2 px-4 w-20">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.tasks.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="py-2 px-4 text-slate-600">{t.wbsNumber || "—"}</td>
                          <td className="py-2 px-4 text-slate-700">{t.title}</td>
                          <td className="py-2 px-4 text-slate-500">{t.storyPoints}</td>
                          <td className="py-2 px-4 text-slate-600">{t.personName ?? "—"}</td>
                          <td className="py-2 px-4 text-slate-500">{Math.round(t.pctComplete * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
