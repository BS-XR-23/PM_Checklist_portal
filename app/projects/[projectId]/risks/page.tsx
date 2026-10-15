import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { StatTile } from "@/components/ui/stat-tile";
import { IconAlertTriangle, IconAlertCircle, IconCheckCircle, IconTarget, IconShield } from "@/components/layout/icons";
import { summarizeRisks, sortRisks } from "@/lib/risks";
import { RiskList } from "./risk-list";

export default async function RiskRegisterPage({ params }: { params: { projectId: string } }) {
  const [access, crAccess] = await Promise.all([
    requireModuleAccess(params.projectId, "RISK_REGISTER", "READ_LIMITED"),
    getModuleAccess(params.projectId, "CR_LOG"),
  ]);
  const canWrite = access === "WRITE";
  // Read Limited hides Notes (docs/USER_GUIDE.md §3) — stripped here, not
  // just hidden in the browser.
  const notesHidden = access === "READ_LIMITED";
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
  const risks = sortRisks(
    rawRisks.map(({ ownerPerson, ...r }) => ({ ...r, ownerPersonName: ownerPerson?.name ?? null, notes: notesHidden ? null : r.notes }))
  );
  const s = summarizeRisks(risks);

  return (
    <div className="space-y-4">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Risks, issues & opportunities</h2>
          <p className="text-sm text-slate-500">
            What could go wrong (risk), what already has (issue), and what could go better than planned (opportunity) — worst first.
          </p>
        </div>
        <a
          href={`/api/projects/${params.projectId}/risks/export`}
          className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export .xlsx
        </a>
      </div>

      {canWrite && (
        <PageGuide
          id="risk-register"
          title="How this register works"
          points={[
            <>Score = Probability × Impact, each Low 1 · Medium 2 · High 3. <strong>6–9 is High</strong>, 3–4 Medium, 1–2 Low.</>,
            <>Any <strong>open</strong> Risk or Issue scoring High makes the project <strong>Critical</strong> on the Dashboard, Projects list and Portfolio. Open means Open, Monitoring or Realized (it happened and is still being dealt with). Opportunities never affect health.</>,
            <>Setting a status of Mitigated, Closed or Not Pursued fills in the closed date; reopening clears it. Keep the description about what could happen and put what you&apos;re doing about it in <strong>Mitigation</strong>.</>,
          ]}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          icon={<IconAlertTriangle />}
          iconWrapClass="bg-rose-50 text-rose-600"
          label="Open — high"
          value={String(s.openHigh)}
          subtitle={s.openHigh ? "makes the project Critical" : "risks & issues"}
          valueColor={s.openHigh ? "#B91C1C" : undefined}
          accentColor={s.openHigh ? "#DC2626" : undefined}
        />
        <StatTile icon={<IconAlertCircle />} iconWrapClass="bg-amber-50 text-amber-600" label="Open — medium" value={String(s.openMedium)} subtitle="risks & issues" />
        <StatTile icon={<IconShield />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Open — low" value={String(s.openLow)} subtitle="risks & issues" />
        <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="Opportunities" value={String(s.openOpportunities)} subtitle="open" />
        <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Closed" value={String(s.closed)} subtitle="mitigated, closed, not pursued" />
      </div>

      <RiskList projectId={params.projectId} rows={risks} canWrite={canWrite} people={people} />
    </div>
  );
}
