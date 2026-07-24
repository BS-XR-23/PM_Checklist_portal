import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import type { ItemStatus } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/rbac";
import { ContractValueField } from "./contract-value-field";
import { MilestoneRow } from "./milestone-row";

export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "MILESTONES", "READ_LIMITED");
  const canWrite = access === "WRITE";
  const notesHidden = access === "READ_LIMITED";

  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });

  const milestones = await prisma.milestonePayment.findMany({
    where: { checklistItem: { projectId: params.projectId } },
    include: { checklistItem: true },
    orderBy: [{ checklistItem: { type: "asc" } }, { checklistItem: { order: "asc" } }],
  });

  const totalAllocatedPct = milestones.reduce((sum, m) => sum + m.paymentPct, 0);
  const paidAmount = milestones
    .filter((m) => m.invoiceStatus === "Paid")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);
  const invoicedAmount = milestones
    .filter((m) => m.invoiceStatus === "Invoiced")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);
  const notInvoicedAmount = milestones
    .filter((m) => m.invoiceStatus === "Not Invoiced")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);

  const allocationOff = Math.round(totalAllocatedPct * 1000) !== 1000; // != 100%, tolerant of float error

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Milestones & Payments</h2>
        <p className="text-sm text-slate-500">
          Milestones are pulled automatically from the PM and DevOps checklists — set payment %, invoice status, and
          sign-off here.
        </p>
      </div>

      {canWrite ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 max-w-xs">
          <ContractValueField projectId={project.id} value={project.contractValue} />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 max-w-xs">
          <p className="text-xs font-medium text-slate-600 mb-1">Total Contract Value</p>
          <p className="text-sm text-slate-800">{formatMoney(project.contractValue)}</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Stage / Category</th>
              <th className="px-3 py-2 font-medium">Milestone</th>
              <th className="px-3 py-2 font-medium">Forecast Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium w-28">Payment %</th>
              <th className="px-3 py-2 font-medium w-32">Tranche Amount</th>
              <th className="px-3 py-2 font-medium w-36">Invoice Status</th>
              <th className="px-3 py-2 font-medium w-36">Client Sign-off</th>
              {!notesHidden && <th className="px-3 py-2 font-medium min-w-[160px]">Notes</th>}
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <MilestoneRow
                key={m.id}
                projectId={project.id}
                contractValue={project.contractValue}
                canWrite={canWrite}
                notesHidden={notesHidden}
                milestone={{
                  id: m.id,
                  paymentPct: m.paymentPct,
                  invoiceStatus: m.invoiceStatus,
                  clientSignoff: m.clientSignoff,
                  notes: notesHidden ? null : m.notes,
                  sourceChecklist: m.checklistItem.type === "PM" ? "PM Checklist" : "DevOps Checklist",
                  stage: m.checklistItem.stage,
                  milestoneName: m.checklistItem.milestoneName ?? "",
                  forecastDate: m.checklistItem.forecastDate,
                  status: m.checklistItem.status as ItemStatus,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 max-w-md">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Payment Summary</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Total % Allocated</dt>
            <dd className="font-medium" style={{ color: allocationOff ? "#C00000" : undefined }}>
              {formatPct(totalAllocatedPct)}
              {allocationOff && " (should total 100%)"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid Amount</dt>
            <dd className="font-medium text-slate-800">{formatMoney(paidAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Invoiced (Awaiting Payment)</dt>
            <dd className="font-medium text-slate-800">{formatMoney(invoicedAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Not Yet Invoiced</dt>
            <dd className="font-medium text-slate-800">{formatMoney(notInvoicedAmount)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
