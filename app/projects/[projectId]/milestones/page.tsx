import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import type { ChecklistType, ItemStatus } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { IconLayers, IconCheckCircle, IconTarget, IconCircle, IconDollar } from "@/components/layout/icons";
import { ContractValueField } from "./contract-value-field";
import { MilestonesTable } from "./milestones-table";
import { AddMilestoneModal } from "./add-milestone-modal";

export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "MILESTONES", "READ_LIMITED");
  const canWrite = access === "WRITE";
  const notesHidden = access === "READ_LIMITED";

  // Independent of each other — fetched concurrently instead of as two
  // serialized round trips.
  const [project, milestones] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.milestonePayment.findMany({
      where: { checklistItem: { projectId: params.projectId } },
      include: { checklistItem: true },
      orderBy: [{ checklistItem: { type: "asc" } }, { checklistItem: { order: "asc" } }],
    }),
  ]);

  const totalAllocatedPct = milestones.reduce((sum, m) => sum + m.paymentPct, 0);
  const paidAmount = milestones
    .filter((m) => m.invoiceStatus === "Paid")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, m.paymentPct), 0);

  const totalMilestones = milestones.length;
  const completedCount = milestones.filter((m) => m.checklistItem.status === "COMPLETED").length;
  const inProgressCount = milestones.filter((m) => m.checklistItem.status === "IN_PROGRESS").length;
  const notStartedCount = milestones.filter((m) => m.checklistItem.status === "NOT_STARTED").length;
  const remainingAmount = project.contractValue - paidAmount;

  const allocationOff = Math.round(totalAllocatedPct * 1000) !== 1000; // != 100%, tolerant of float error

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Milestones & Payments</h2>
          <p className="text-sm text-slate-500">
            Milestones are pulled automatically from PM and DevOps checklists — set payment %, invoice status, and
            sign-off here.
          </p>
        </div>
        {canWrite && <AddMilestoneModal projectId={project.id} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr] items-start">
        {canWrite ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <ContractValueField projectId={project.id} value={project.contractValue} />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-600 mb-1">Total Contract Value</p>
            <p className="text-sm text-slate-800">{formatMoney(project.contractValue)}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Milestones" value={String(totalMilestones)} subtitle="Milestones" />
          <StatTile
            icon={<IconCheckCircle />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Completed"
            value={String(completedCount)}
            subtitle={formatPct(totalMilestones ? completedCount / totalMilestones : 0)}
          />
          <StatTile
            icon={<IconTarget />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="In Progress"
            value={String(inProgressCount)}
            subtitle={formatPct(totalMilestones ? inProgressCount / totalMilestones : 0)}
          />
          <StatTile
            icon={<IconCircle />}
            iconWrapClass="bg-slate-100 text-slate-500"
            label="Not Started"
            value={String(notStartedCount)}
            subtitle={formatPct(totalMilestones ? notStartedCount / totalMilestones : 0)}
          />
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Total Paid"
            value={formatMoney(paidAmount)}
            subtitle={`${formatPct(project.contractValue ? paidAmount / project.contractValue : 0)} of contract`}
          />
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Remaining"
            value={formatMoney(remainingAmount)}
            subtitle={`${formatPct(project.contractValue ? remainingAmount / project.contractValue : 0)} of contract`}
          />
        </div>
      </div>

      <MilestonesTable
        projectId={project.id}
        contractValue={project.contractValue}
        canWrite={canWrite}
        notesHidden={notesHidden}
        totalAllocatedPct={totalAllocatedPct}
        allocationOff={allocationOff}
        rows={milestones.map((m) => ({
          id: m.id,
          checklistItemId: m.checklistItemId,
          paymentPct: m.paymentPct,
          invoiceStatus: m.invoiceStatus,
          clientSignoff: m.clientSignoff,
          notes: notesHidden ? null : m.notes,
          checklistType: m.checklistItem.type as ChecklistType,
          stage: m.checklistItem.stage,
          milestoneName: m.checklistItem.milestoneName ?? "",
          actualDate: m.checklistItem.actualDate,
          status: m.checklistItem.status as ItemStatus,
        }))}
      />
    </div>
  );
}
