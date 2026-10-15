import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { StatTile } from "@/components/ui/stat-tile";
import { IconTarget, IconClock, IconCheckCircle, IconDollar, IconAlertCircle } from "@/components/layout/icons";
import { formatMoney } from "@/lib/format";
import { summarizeCrs, crWarnings } from "@/lib/risks";
import { CrList } from "./cr-list";

export default async function CrLogPage({ params }: { params: { projectId: string } }) {
  const [access, riskAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "CR_LOG", "READ_LIMITED"),
    getModuleAccess(params.projectId, "RISK_REGISTER"),
  ]);
  const canWrite = access === "WRITE";
  // Read Limited hides financial fields and Notes — stripped here, not just hidden in the browser.
  const financialsHidden = access === "READ_LIMITED";
  const subNavOptions = [
    ...(riskAccess !== "NONE" ? [{ href: "/risks", label: "Risk Register" }] : []),
    { href: "/change-requests", label: "CR Log" },
  ];

  const [crs, project] = await Promise.all([
    prisma.changeRequest.findMany({ where: { projectId: params.projectId }, orderBy: { crCode: "asc" } }),
    prisma.project.findUnique({ where: { id: params.projectId }, select: { contractValue: true } }),
  ]);

  const s = summarizeCrs(crs);
  const needFixing = crs.filter((cr) => crWarnings(cr, financialsHidden).length > 0).length;
  const rows = financialsHidden ? crs.map((cr) => ({ ...cr, rate: null, notes: null })) : crs;

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Change requests</h2>
          <p className="text-sm text-slate-500">Work asked for beyond the signed scope — proposed, agreed with the client, and delivered.</p>
        </div>
        <a
          href={`/api/projects/${params.projectId}/change-requests/export`}
          className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export .xlsx
        </a>
      </div>

      {canWrite && (
        <PageGuide
          id="cr-log"
          title="How the CR Log works"
          points={[
            <><strong>Man-days planned</strong> is your estimate while the CR is proposed; <strong>billable man-days</strong> is what the client agreed to pay for. Amount = billable man-days × rate — keep the rate in line with the CR Rate Policy from the PM Checklist&apos;s Planning stage.</>,
            <><strong>Paid CR value</strong> adds up only Paid CRs the client has agreed to (Approved, In Progress or Completed). Proposed, Rejected, Free and Exchange CRs add nothing.</>,
            <>Once a CR is agreed it should have client sign-off and an updated WBS — the list flags any that don&apos;t. To keep a declined CR on record, set it to Rejected rather than deleting it.</>,
          ]}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          icon={<IconTarget />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Waiting for approval"
          value={String(s.proposed.count)}
          subtitle={s.proposed.count ? `${s.proposed.plannedManDays} man-days estimated` : "proposed"}
        />
        <StatTile
          icon={<IconClock />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="Approved & in progress"
          value={String(s.inWork.count)}
          subtitle={s.inWork.count ? `${s.inWork.billableManDays} billable man-days` : "being delivered"}
        />
        <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Completed" value={String(s.completed)} subtitle={s.rejected ? `${s.rejected} rejected` : undefined} />
        {!financialsHidden && (
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Paid CR value"
            value={formatMoney(s.paidValue)}
            subtitle={project?.contractValue ? `on top of the ${formatMoney(project.contractValue)} contract` : "agreed Paid CRs"}
          />
        )}
        <StatTile
          icon={<IconAlertCircle />}
          iconWrapClass={needFixing ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}
          label="Need attention"
          value={String(needFixing)}
          subtitle="agreed but missing sign-off, WBS or amount"
          accentColor={needFixing ? "#D97706" : undefined}
        />
      </div>

      <CrList projectId={params.projectId} rows={rows} canWrite={canWrite} financialsHidden={financialsHidden} />
    </div>
  );
}
