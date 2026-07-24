import { prisma } from "@/lib/prisma";
import { computeCrKpis } from "@/lib/calculations";
import { requireModuleAccess } from "@/lib/rbac";
import { AddCrButton } from "./add-cr-button";
import { CrRow } from "./cr-row";

export default async function CrLogPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "CR_LOG", "READ_LIMITED");
  const canWrite = access === "WRITE";
  const financialsHidden = access === "READ_LIMITED";

  const crs = await prisma.changeRequest.findMany({
    where: { projectId: params.projectId },
    orderBy: { crCode: "asc" },
  });

  const kpis = computeCrKpis(crs);
  const visibleCrs = financialsHidden ? crs.map((cr) => ({ ...cr, rate: null })) : crs;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Change Request (CR) Log</h2>
          <p className="text-sm text-slate-500">
            Amount = Billable Man-Days x Rate. Rate should match the CR Rate Policy defined in the PM Checklist
            (Planning stage).
          </p>
        </div>
        {canWrite && <AddCrButton projectId={params.projectId} />}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <KpiTile label="Upcoming CR # (man-days, Proposed)" value={kpis.upcomingCrManDays} />
        <KpiTile label="Work Order CR # (billable man-days, Approved + In Progress)" value={kpis.workOrderCrManDays} />
        <KpiTile label="Remaining CR # (billable man-days, In Progress)" value={kpis.remainingCrManDays} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium w-20">CR ID</th>
              <th className="px-3 py-2 font-medium min-w-[160px]">Title</th>
              <th className="px-3 py-2 font-medium w-36">Date Raised</th>
              <th className="px-3 py-2 font-medium min-w-[180px]">Description</th>
              <th className="px-3 py-2 font-medium w-28">Man-Days Planned</th>
              <th className="px-3 py-2 font-medium w-28">Billable Man-Days</th>
              {!financialsHidden && <th className="px-3 py-2 font-medium w-20">Rate</th>}
              {!financialsHidden && <th className="px-3 py-2 font-medium w-28">Amount</th>}
              <th className="px-3 py-2 font-medium w-24">Type</th>
              <th className="px-3 py-2 font-medium w-32">Client Sign-off</th>
              <th className="px-3 py-2 font-medium w-24">WBS Updated</th>
              <th className="px-3 py-2 font-medium w-28">Status</th>
              <th className="px-3 py-2 font-medium min-w-[160px]">Notes</th>
              {canWrite && <th className="px-3 py-2 font-medium w-8" />}
            </tr>
          </thead>
          <tbody>
            {visibleCrs.map((cr) => (
              <CrRow key={cr.id} projectId={params.projectId} cr={cr} canWrite={canWrite} financialsHidden={financialsHidden} />
            ))}
          </tbody>
        </table>
        {crs.length === 0 && <p className="text-sm text-slate-400 p-4">No change requests logged yet.</p>}
      </div>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
