import { prisma } from "@/lib/prisma";
import { formatPct } from "@/lib/format";
import type { ItemStatus } from "@/lib/constants";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { IconLayers, IconCheckCircle, IconTarget, IconCircle } from "@/components/layout/icons";
import { MilestonesTable } from "./milestones-table";
import { AddMilestoneModal } from "./add-milestone-modal";

export const dynamic = "force-dynamic";

// Delivery Milestones — development delivery checkpoints (MVP Complete, UAT
// Ready, Production Release, ...), gated on DELIVERY. Deliberately excludes
// any Milestone row that carries a payment tranche: those belong exclusively
// to "Milestones & Payments" (app/projects/[projectId]/milestones), a
// separate feature with a different goal (invoicing/sign-off, not delivery
// tracking) — the two lists never overlap.
export default async function DeliveryMilestonesPage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const access = await requireModuleAccess(projectId, "DELIVERY", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [milestones, people] = await Promise.all([
    prisma.milestone.findMany({
      where: { projectId, payment: null },
      include: { ownerPerson: true },
      orderBy: [{ order: "asc" }, { plannedDate: "asc" }],
    }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalMilestones = milestones.length;
  const completedCount = milestones.filter((m) => m.status === "COMPLETED").length;
  const inProgressCount = milestones.filter((m) => m.status === "IN_PROGRESS").length;
  const notStartedCount = milestones.filter((m) => m.status === "NOT_STARTED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Milestones</h2>
          <p className="text-sm text-slate-500">
            Major development delivery checkpoints — not individual tasks, and not tied to payment. For payment
            tranches and invoice/sign-off tracking, see the project&apos;s Milestones &amp; Payments tab.
          </p>
        </div>
        {canWrite && <AddMilestoneModal projectId={projectId} />}
      </div>

      <PageGuide
        id="delivery-milestones"
        title="How this differs from Milestones & Payments"
        points={[
          <>These are development checkpoints only (&quot;MVP Complete&quot;, &quot;UAT Ready&quot;) — nothing here ever triggers an invoice or payment tranche.</>,
          <>If a checkpoint should also trigger a client payment, add it under the project&apos;s <strong>Milestones &amp; Payments</strong> tab instead — the two lists are kept deliberately separate and never overlap.</>,
          <>Status, % Complete, and dates are self-reported by the owner here — they aren&apos;t derived automatically from Tasks or Sprints.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Milestones" value={String(totalMilestones)} />
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
      </div>

      <MilestonesTable
        projectId={projectId}
        canWrite={canWrite}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        rows={milestones.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          description: m.description,
          status: m.status as ItemStatus,
          pctComplete: m.pctComplete,
          plannedDate: m.plannedDate,
          forecastDate: m.forecastDate,
          actualDate: m.actualDate,
          ownerPersonId: m.ownerPersonId,
          ownerPersonName: m.ownerPerson?.name ?? null,
          acceptanceCriteria: m.acceptanceCriteria,
        }))}
      />
    </div>
  );
}
