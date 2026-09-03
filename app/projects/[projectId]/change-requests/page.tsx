import { prisma } from "@/lib/prisma";
import { computeCrKpis, crAmount } from "@/lib/calculations";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { StatTile } from "@/components/ui/stat-tile";
import { IconLayers, IconTarget, IconClock, IconAlertCircle, IconDollar } from "@/components/layout/icons";
import { formatMoney } from "@/lib/format";
import { AddCrButton } from "./add-cr-button";
import { CrTable } from "./cr-table";

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
  const totalAmount = crs.reduce((sum, cr) => sum + (crAmount(cr.billableManDays, cr.rate) ?? 0), 0);
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
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/projects/${params.projectId}/change-requests/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddCrButton projectId={params.projectId} />}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total CRs" value={String(crs.length)} />
        <StatTile icon={<IconTarget />} iconWrapClass="bg-amber-50 text-amber-600" label="Upcoming (Proposed)" value={String(kpis.upcomingCrManDays)} subtitle="man-days" />
        <StatTile icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" label="Work Order (Approved + In Progress)" value={String(kpis.workOrderCrManDays)} subtitle="billable man-days" />
        <StatTile icon={<IconAlertCircle />} iconWrapClass="bg-indigo-50 text-indigo-600" label="Remaining (In Progress)" value={String(kpis.remainingCrManDays)} subtitle="billable man-days" />
        {!financialsHidden && (
          <StatTile icon={<IconDollar />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Total Amount" value={formatMoney(totalAmount)} />
        )}
      </div>

      <CrTable projectId={params.projectId} canWrite={canWrite} financialsHidden={financialsHidden} rows={visibleCrs} />
    </div>
  );
}
