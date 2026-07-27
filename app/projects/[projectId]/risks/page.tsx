import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { AddRiskButton } from "./add-risk-button";
import { RiskRow } from "./risk-row";

export default async function RiskRegisterPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "RISK_REGISTER", "READ_LIMITED");
  const canWrite = access === "WRITE";

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Risk & Issue Register</h2>
          <p className="text-sm text-slate-500">
            Risk Score = Probability x Impact (Low=1, Medium=2, High=3). 1-2 Low, 3-4 Medium, 6-9 High.
          </p>
        </div>
        {canWrite && <AddRiskButton projectId={params.projectId} />}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium w-28">Type</th>
              <th className="px-3 py-2 font-medium w-32">Category</th>
              <th className="px-3 py-2 font-medium min-w-[220px]">Description</th>
              <th className="px-3 py-2 font-medium w-24">Probability</th>
              <th className="px-3 py-2 font-medium w-24">Impact</th>
              <th className="px-3 py-2 font-medium w-20">Score</th>
              <th className="px-3 py-2 font-medium w-28">Owner</th>
              <th className="px-3 py-2 font-medium min-w-[200px]">Mitigation / Response Plan</th>
              <th className="px-3 py-2 font-medium w-32">Status</th>
              <th className="px-3 py-2 font-medium w-36">Date Raised</th>
              <th className="px-3 py-2 font-medium w-36">Date Closed</th>
              <th className="px-3 py-2 font-medium min-w-[160px]">Notes</th>
              {canWrite && <th className="px-3 py-2 font-medium w-8" />}
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <RiskRow key={r.id} projectId={params.projectId} risk={r} canWrite={canWrite} people={people} />
            ))}
          </tbody>
        </table>
        {risks.length === 0 && <p className="text-sm text-slate-400 p-4">No risks logged yet.</p>}
      </div>
    </div>
  );
}
