import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { WbsTasksTable } from "../delivery-tasks-table";
import { UploadWbsTasksForm } from "../upload-wbs-tasks-form";

export const dynamic = "force-dynamic";

export default async function DeliveryTasksPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "DELIVERY", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [tasks, engagements] = await Promise.all([
    prisma.wbsTask.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: "asc" } }),
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
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — Tasks</h2>
        <p className="text-sm text-slate-500">
          The project-wide WBS — defined once here, tracked week by week on the Weekly CPI tab. Man-days is the
          estimate; the default assignee here is just a starting point, overridable per week.
        </p>
      </div>

      <WbsTasksTable projectId={params.projectId} tasks={tasks} roster={roster} canWrite={canWrite} />
      {canWrite && <UploadWbsTasksForm projectId={params.projectId} />}
    </div>
  );
}
