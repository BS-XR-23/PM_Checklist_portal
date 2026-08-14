import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { AddWeekButton } from "../add-week-button";
import { DeliveryWeekRow } from "../delivery-week-row";

export const dynamic = "force-dynamic";

export default async function DeliveryTasksPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [weeks, engagements] = await Promise.all([
    prisma.wbsWeek.findMany({
      where: { projectId: params.projectId },
      orderBy: { weekEnding: "asc" },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.projectEngagement.findMany({
      where: { projectId: params.projectId },
      include: { person: { include: { competency: true } } },
      orderBy: { person: { name: "asc" } },
    }),
  ]);

  const roster = Array.from(new Map(engagements.map((e) => [e.personId, e])).values()).map((e) => ({
    personId: e.person.id,
    personName: e.person.name,
    competencyLevel: e.person.competency?.level ?? null,
  }));

  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Weekly CPI" },
          { href: "/delivery/tasks", label: "Tasks" },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Tasks</h2>
          <p className="text-sm text-slate-500">
            The WBS task list, per week — Man-days and % are the estimate, Actual Man-days is real days spent. Feeds
            Weekly CPI directly; nothing here needs to be entered twice.
          </p>
        </div>
        {canWrite && <AddWeekButton projectId={params.projectId} />}
      </div>

      <div className="space-y-3">
        {weeks.map((w) => (
          <DeliveryWeekRow key={w.id} projectId={params.projectId} week={w} roster={roster} canWrite={canWrite} />
        ))}
        {weeks.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-400">No WBS weeks yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
