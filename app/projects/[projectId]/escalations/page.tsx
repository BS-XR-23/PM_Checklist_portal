import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { AddEscalationForm } from "./add-escalation-form";
import { EscalationRow } from "./escalation-row";

export default async function EscalationsPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);
  if (user.role !== "TPM" && user.role !== "ADMIN") redirect(`/projects/${params.projectId}/dashboard`);

  const items = await prisma.escalationItem.findMany({
    where: { projectId: params.projectId },
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Escalations</h2>
        <p className="text-sm text-slate-500">
          TPM&apos;s dedicated write surface for this project — acknowledging alerts, tagging portfolio-level risks,
          flagging resource conflicts. This never touches the PM&apos;s checklist/milestone/risk/CR/budget data
          directly; use the &quot;Override&quot; control on a checklist item for that, which is logged separately.
        </p>
      </div>

      <AddEscalationForm projectId={params.projectId} />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium w-40">Type</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium min-w-[200px]">Notes</th>
              <th className="px-3 py-2 font-medium w-32">Status</th>
              <th className="px-3 py-2 font-medium w-40">Raised By</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <EscalationRow
                key={item.id}
                projectId={params.projectId}
                item={{ id: item.id, type: item.type, title: item.title, notes: item.notes, status: item.status, createdByName: item.createdBy.name }}
              />
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="text-sm text-slate-400 p-4">No escalations raised yet.</p>}
      </div>
    </div>
  );
}
