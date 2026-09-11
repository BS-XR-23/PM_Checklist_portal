import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { IconShield, IconAlertTriangle, IconAlertCircle, IconCheckCircle, IconClock } from "@/components/layout/icons";
import { riskScoreSeverity } from "@/lib/colors";
import { riskScore } from "@/lib/calculations";
import { AddRiskButton } from "./add-risk-button";
import { RiskTable } from "./risk-table";

function RiskStatCard({
  label,
  value,
  subtitle,
  valueColor,
  icon,
  iconWrapClass,
}: {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
  icon: React.ReactNode;
  iconWrapClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold leading-tight" style={{ color: valueColor }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: valueColor }}>
            {subtitle}
          </p>
        )}
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
        <span className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      </span>
    </div>
  );
}

export default async function RiskRegisterPage({ params }: { params: { projectId: string } }) {
  const [access, crAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "RISK_REGISTER", "READ_LIMITED"),
    getModuleAccess(params.projectId, "CR_LOG"),
  ]);
  const canWrite = access === "WRITE";
  const subNavOptions = [
    { href: "/risks", label: "Risk Register" },
    ...(crAccess !== "NONE" ? [{ href: "/change-requests", label: "CR Log" }] : []),
  ];

  const [rawRisks, people] = await Promise.all([
    prisma.riskItem.findMany({
      where: { projectId: params.projectId },
      orderBy: { order: "asc" },
      include: { ownerPerson: { select: { id: true, name: true } } },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const risks = rawRisks.map((r) => ({ ...r, ownerPersonName: r.ownerPerson?.name ?? null }));

  const totalRisks = risks.length;
  const severities = risks.map((r) => riskScoreSeverity(riskScore(r.probability, r.impact)));
  const highCount = severities.filter((s) => s === "high").length;
  const mediumCount = severities.filter((s) => s === "medium").length;
  const lowCount = severities.filter((s) => s === "low").length;
  const openCount = risks.filter((r) => r.status === "Open" || r.status === "Monitoring").length;
  const closedCount = risks.filter((r) => r.status === "Closed" || r.status === "Mitigated" || r.status === "Not Pursued").length;
  const pct = (n: number) => (totalRisks ? `${Math.round((n / totalRisks) * 100)}%` : undefined);

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Risk & Issue Register</h2>
          <p className="text-sm text-slate-500">
            Risk Score = Probability x Impact (Low=1, Medium=2, High=3). 1-2 Low, 3-4 Medium, 6-9 High.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/projects/${params.projectId}/risks/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddRiskButton projectId={params.projectId} />}
        </div>
      </div>

      <PageGuide
        id="risk-register"
        title="How to fill this in"
        points={[
          <>Risk Score = Probability × Impact, each scored Low=1/Medium=2/High=3 — 1-2 is Low, 3-4 is Medium, 6-9 is High.</>,
          <>The stat tiles above count Open and Monitoring as &quot;open&quot;, and Mitigated/Closed/Not Pursued as &quot;closed&quot; — a risk marked <strong>Realized</strong> (it actually happened) falls into neither count, so check the table directly for those.</>,
          <>Use <strong>Mitigation / Response Plan</strong> for the actual action being taken — keep the risk description itself focused on what could go wrong, not what you&apos;re doing about it.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <RiskStatCard label="Total Risks" value={String(totalRisks)} icon={<IconShield />} iconWrapClass="bg-blue-50 text-blue-600" />
        <RiskStatCard
          label="High (6-9)"
          value={String(highCount)}
          subtitle={pct(highCount)}
          valueColor="#C00000"
          icon={<IconAlertTriangle />}
          iconWrapClass="bg-rose-50 text-rose-600"
        />
        <RiskStatCard
          label="Medium (3-4)"
          value={String(mediumCount)}
          subtitle={pct(mediumCount)}
          valueColor="#7A5B00"
          icon={<IconAlertCircle />}
          iconWrapClass="bg-amber-50 text-amber-600"
        />
        <RiskStatCard
          label="Low (1-2)"
          value={String(lowCount)}
          subtitle={pct(lowCount)}
          valueColor="#2C5F2D"
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
        />
        <RiskStatCard label="Open" value={String(openCount)} subtitle={pct(openCount)} valueColor="#1D4ED8" icon={<IconClock />} iconWrapClass="bg-blue-50 text-blue-600" />
        <RiskStatCard
          label="Closed"
          value={String(closedCount)}
          subtitle={pct(closedCount)}
          valueColor="#475569"
          icon={<IconCheckCircle />}
          iconWrapClass="bg-slate-100 text-slate-500"
        />
      </div>

      <RiskTable projectId={params.projectId} canWrite={canWrite} people={people} rows={risks} />
    </div>
  );
}
