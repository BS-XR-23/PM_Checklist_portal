import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import type { ItemStatus } from "@/lib/constants";
import { countOverdueMilestones } from "@/lib/project-health";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { IconLayers, IconCheckCircle, IconTarget, IconAlertCircle, IconDollar } from "@/components/layout/icons";
import { ContractValueField } from "./contract-value-field";
import { MilestonesTable } from "./milestones-table";
import { AddMilestoneModal } from "./add-milestone-modal";

export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "MILESTONES", "READ_LIMITED");
  const canWrite = access === "WRITE";
  const notesHidden = access === "READ_LIMITED";

  // Independent of each other — fetched concurrently instead of serialized round trips.
  const [project, milestones, people] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.milestone.findMany({
      where: { projectId: params.projectId },
      include: {
        payment: true,
        ownerPerson: { select: { name: true } },
        checklistItems: { select: { status: true } }, // linked gates
      },
      orderBy: [{ plannedDate: { sort: "asc", nulls: "last" } }, { order: "asc" }],
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const pctOf = (m: (typeof milestones)[number]) => m.payment?.paymentPct ?? 0;
  const totalAllocatedPct = milestones.reduce((sum, m) => sum + pctOf(m), 0);
  const paidAmount = milestones
    .filter((m) => m.payment?.invoiceStatus === "Paid")
    .reduce((sum, m) => sum + trancheAmount(project.contractValue, pctOf(m)), 0);

  const totalMilestones = milestones.length;
  const completedCount = milestones.filter((m) => m.status === "COMPLETED").length;
  const inProgressCount = milestones.filter((m) => m.status === "IN_PROGRESS").length;
  const overdueCount = countOverdueMilestones(milestones);
  const remainingAmount = project.contractValue - paidAmount;

  const allocationOff = Math.round(totalAllocatedPct * 1000) !== 1000; // != 100%, tolerant of float error

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Milestones & Payments</h2>
          <p className="text-sm text-slate-500">
            The project&apos;s client-facing delivery commitments — dates, status, payment tranche, invoice, and
            client sign-off in one place.
          </p>
        </div>
        {canWrite && <AddMilestoneModal projectId={project.id} />}
      </div>

      <PageGuide
        id="milestones-payments"
        title="Milestones vs. Gates"
        points={[
          <><strong>Milestones</strong> (this page) are what you deliver to the client — e.g. Phase 1 MVP, UAT Complete, Go-Live. Each carries its dates, owner, payment %, invoice status, and client sign-off. Dashboard, Delivery, Portfolio, and the PM Plan all read this list.</>,
          <><strong>Gates</strong> are internal checkpoints on the Checklist tab (e.g. &quot;DoR Approved&quot;, &quot;CI Pipeline Green&quot;). They never carry payment. A milestone shows <em>Gates 2/3</em> when checklist gates are linked to it.</>,
          <>Payment % across every milestone should add up to 100% of Contract Value — the table flags it if the allocation is off. A milestone that&apos;s already invoiced or paid can&apos;t be deleted until its invoice status is reset.</>,
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_1fr] items-start">
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
            icon={<IconAlertCircle />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Overdue"
            value={String(overdueCount)}
            subtitle="Past planned date"
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
        people={people}
        rows={milestones.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          plannedDate: m.plannedDate,
          forecastDate: m.forecastDate,
          actualDate: m.actualDate,
          status: m.status as ItemStatus,
          ownerPersonId: m.ownerPersonId,
          ownerName: m.ownerPerson?.name ?? null,
          paymentPct: pctOf(m),
          invoiceStatus: m.payment?.invoiceStatus ?? "Not Invoiced",
          clientSignoff: m.payment?.clientSignoff ?? "Pending",
          notes: notesHidden ? null : m.payment?.notes ?? null,
          gatesDone: m.checklistItems.filter((g) => g.status === "COMPLETED" || g.status === "NOT_APPLICABLE").length,
          gatesTotal: m.checklistItems.length,
        }))}
      />
    </div>
  );
}
