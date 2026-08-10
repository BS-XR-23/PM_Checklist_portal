import { prisma } from "@/lib/prisma";
import { computeCrKpis } from "@/lib/calculations";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { AddCrButton } from "./add-cr-button";
import { CrRow } from "./cr-row";

export default async function CrLogPage({ params }: { params: { projectId: string } }) {
  const [access, riskAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "CR_LOG", "READ_LIMITED"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
  ]);
  const canWrite = access === "WRITE";
  const financialsHidden = access === "READ_LIMITED";
  const subNavOptions = [
    ...(riskAccess !== "NONE" ? [{ href: "/risks", label: "Risk Register" }] : []),
    { href: "/change-requests", label: "CR Log" },
  ];

  const crs = await prisma.changeRequest.findMany({
    where: { projectId: params.projectId },
    orderBy: { crCode: "asc" },
  });

  const kpis = computeCrKpis(crs);
  const visibleCrs = financialsHidden ? crs.map((cr) => ({ ...cr, rate: null })) : crs;

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
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

      <div className="space-y-3">
        {visibleCrs.map((cr) => (
          <CrRow key={cr.id} projectId={params.projectId} cr={cr} canWrite={canWrite} financialsHidden={financialsHidden} />
        ))}
        {crs.length === 0 && <p className="text-sm text-slate-400">No change requests logged yet.</p>}
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
