import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import type { ItemStatus } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/rbac";
import { summarizeMilestones, contractMoneySplit, milestoneFlags, milestoneDueDate, isMilestoneDone } from "@/lib/milestones";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { MoneyBar } from "@/components/ui/money-bar";
import { IconCheckCircle, IconTarget, IconAlertCircle, IconAlertTriangle } from "@/components/layout/icons";
import { ContractValueField } from "./contract-value-field";
import { MilestoneList, type MilestoneRow } from "./milestone-list";

export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "MILESTONES", "READ_LIMITED");
  const canWrite = access === "WRITE";
  // Read Limited hides financial fields and Notes (docs/USER_GUIDE.md §3):
  // no contract value, payment %, tranche or invoice status — stripped here,
  // not just hidden in the browser.
  const showMoney = access !== "READ_LIMITED";

  const [project, milestones, people] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { id: true, contractValue: true } }),
    prisma.milestone.findMany({
      where: { projectId: params.projectId },
      include: {
        payment: true,
        ownerPerson: { select: { name: true } },
        checklistItems: { select: { status: true } },
      },
      orderBy: { order: "asc" },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const today = new Date();
  const summary = summarizeMilestones(
    milestones.map((m) => ({ ...m, ownerName: m.ownerPerson?.name ?? null })),
    project.contractValue,
    today
  );
  const money = contractMoneySplit(project.contractValue, summary);

  // Timeline order: when it happened (done) or is due; undated last.
  const when = (m: (typeof milestones)[number]) => (m.status === "COMPLETED" ? m.actualDate ?? milestoneDueDate(m) : milestoneDueDate(m));
  const ordered = [...milestones].sort((a, b) => (when(a)?.getTime() ?? Infinity) - (when(b)?.getTime() ?? Infinity) || a.order - b.order);

  const rows: MilestoneRow[] = ordered.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    description: m.description,
    acceptanceCriteria: m.acceptanceCriteria,
    plannedDate: m.plannedDate,
    forecastDate: m.forecastDate,
    actualDate: m.actualDate,
    status: m.status as ItemStatus,
    ownerPersonId: m.ownerPersonId,
    ownerName: m.ownerPerson?.name ?? null,
    paymentPct: showMoney ? m.payment?.paymentPct ?? 0 : null,
    invoiceStatus: showMoney ? m.payment?.invoiceStatus ?? "Not Invoiced" : null,
    clientSignoff: m.payment?.clientSignoff ?? "Pending",
    notes: showMoney ? m.payment?.notes ?? null : null,
    checkpointsDone: m.checklistItems.filter((g) => g.status === "COMPLETED" || g.status === "NOT_APPLICABLE").length,
    checkpointsTotal: m.checklistItems.length,
    flags: milestoneFlags(
      { ...m, payment: m.payment ? { paymentPct: m.payment.paymentPct, invoiceStatus: m.payment.invoiceStatus, clientSignoff: m.payment.clientSignoff } : null },
      today,
      showMoney
    ),
  }));

  const applicable = milestones.filter((m) => m.status !== "NOT_APPLICABLE");
  const doneCount = applicable.filter((m) => isMilestoneDone(m)).length;
  const flagged = rows.filter((r) => r.flags.some((f) => f.tone !== "blue")).length;
  const allocatedPct = summary.totalAllocatedPct;
  const allocationOk = Math.round(allocatedPct * 1000) === 1000;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Milestones & Payments</h2>
        <p className="text-sm text-slate-500">
          What this project delivers to the client and when{showMoney ? ", and the payment tied to each" : ""}. Dashboard, Delivery, Portfolio and the PM Plan all read this list.
        </p>
      </div>

      {canWrite && (
        <PageGuide
          id="milestones-payments"
          title="How milestones work"
          points={[
            <><strong>Milestones</strong> are client-facing commitments (Phase 1 MVP, UAT complete, Go-Live). <strong>Checkpoints</strong> are internal steps tagged on the Checklist tab — they show here as &quot;checkpoints 2/3&quot; but never carry payment.</>,
            <>A milestone is due on its <strong>forecast</strong> date if you&apos;ve moved it, otherwise its planned date. Marking it Completed fills in today as the actual date (if empty); reopening clears it.</>,
            <>Payment % across all milestones should reach 100% of the contract and can&apos;t go over. A milestone that&apos;s invoiced or paid can&apos;t be deleted until its invoice is set back to Not Invoiced.</>,
          ]}
        />
      )}

      {showMoney && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {canWrite ? (
              <div className="w-56">
                <ContractValueField projectId={project.id} value={project.contractValue} />
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500">Contract value</p>
                <p className="text-2xl font-bold text-slate-900">{formatMoney(project.contractValue)}</p>
              </div>
            )}
            <p className={allocationOk ? "text-xs text-emerald-700" : "text-xs font-medium text-amber-700"}>
              {allocationOk
                ? "100% of the contract is on milestones."
                : allocatedPct > 1.0001
                  ? `Payments add up to ${formatPct(allocatedPct)} — more than the contract.`
                  : `Payments cover ${formatPct(allocatedPct)} of the contract — ${formatPct(1 - allocatedPct)} isn't on any milestone yet.`}
            </p>
          </div>
          {project.contractValue > 0 && (
            <div className="mt-3 space-y-2">
              <MoneyBar money={money} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="Delivered"
          value={`${doneCount} of ${applicable.length}`}
          subtitle={applicable.length ? formatPct(doneCount / applicable.length) : "no milestones yet"}
        />
        <StatTile
          icon={<IconTarget />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="Next milestone"
          value={summary.nextMilestone ? formatDate(summary.nextMilestone.date) : "—"}
          subtitle={summary.nextMilestone?.name ?? "nothing upcoming with a date"}
        />
        <StatTile
          icon={<IconAlertCircle />}
          iconWrapClass={summary.overdue.length ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}
          label="Overdue"
          value={String(summary.overdue.length)}
          subtitle="past their due date (forecast, else planned)"
          accentColor={summary.overdue.length ? "#DC2626" : undefined}
        />
        <StatTile
          icon={<IconAlertTriangle />}
          iconWrapClass={flagged ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}
          label="Need attention"
          value={String(flagged)}
          subtitle="flagged below"
          accentColor={flagged ? "#D97706" : undefined}
        />
      </div>

      <MilestoneList projectId={project.id} rows={rows} contractValue={project.contractValue} canWrite={canWrite} showMoney={showMoney} people={people} />
    </div>
  );
}
