import { prisma } from "@/lib/prisma";
import { requireModuleAccess, getModuleAccess } from "@/lib/rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { AddRiskButton } from "./add-risk-button";
import { RiskRow } from "./risk-row";

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
        {canWrite && <AddRiskButton projectId={params.projectId} />}
      </div>

      <div className="space-y-3">
        {risks.map((r) => (
          <RiskRow key={r.id} projectId={params.projectId} risk={r} canWrite={canWrite} people={people} />
        ))}
        {risks.length === 0 && <p className="text-sm text-slate-400">No risks logged yet.</p>}
      </div>
    </div>
  );
}
