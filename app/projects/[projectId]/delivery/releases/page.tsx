import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { IconLayers, IconCheckCircle, IconClock, IconAlertTriangle } from "@/components/layout/icons";
import { ReleasesTable } from "./releases-table";
import { AddReleaseModal } from "./add-release-modal";

export const dynamic = "force-dynamic";

export default async function ReleasesPage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const access = await requireModuleAccess(projectId, "RELEASE", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [releases, milestones, sprints, wbsTasks, people] = await Promise.all([
    prisma.release.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        ownerPerson: true,
        relatedMilestone: true,
        sprints: { include: { sprint: true } },
        wbsTasks: { include: { wbsTask: true } },
      },
    }),
    // payment: null — a Release only links to Delivery's own development
    // milestones, never the unrelated payment-tranche-linked ones.
    prisma.milestone.findMany({ where: { projectId, payment: null }, orderBy: { plannedDate: "asc" } }),
    prisma.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    prisma.wbsTask.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  const deployed = releases.filter((r) => r.deploymentStatus === "Deployed").length;
  const planned = releases.filter((r) => r.deploymentStatus === "Planned").length;
  const failedOrRolledBack = releases.filter((r) => r.deploymentStatus === "Failed" || r.deploymentStatus === "Rolled Back").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery — Releases</h2>
          <p className="text-sm text-slate-500">
            What version/build is being shipped, and where — distinct from a Milestone (a checkpoint like
            &quot;Development Complete&quot;). &quot;Version 1.4.0 deployed to UAT&quot; is a Release.
          </p>
        </div>
        {canWrite && <AddReleaseModal projectId={projectId} />}
      </div>

      <PageGuide
        id="delivery-releases"
        title="How to fill this in"
        points={[
          <>A Release is a shipped version/build — &quot;1.4.0 deployed to UAT&quot; — distinct from a Milestone, which is a checkpoint like &quot;Development Complete&quot;.</>,
          <>Link a release to the Sprints and WBS tasks it actually contains, and optionally to the Milestone it fulfills, so its scope is traceable.</>,
          <><strong>Deployment Status</strong> and <strong>Approval Status</strong> are tracked independently — a build can be deployed before it&apos;s formally approved, or vice versa, depending on your process.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Releases" value={String(releases.length)} />
        <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Deployed" value={String(deployed)} />
        <StatTile icon={<IconClock />} iconWrapClass="bg-amber-50 text-amber-600" label="Planned" value={String(planned)} />
        <StatTile icon={<IconAlertTriangle />} iconWrapClass="bg-rose-50 text-rose-600" label="Failed / Rolled Back" value={String(failedOrRolledBack)} />
      </div>

      <ReleasesTable
        projectId={projectId}
        canWrite={canWrite}
        milestones={milestones.map((m) => ({ id: m.id, name: m.name }))}
        sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
        wbsTasks={wbsTasks.map((t) => ({ id: t.id, wbsNumber: t.wbsNumber, title: t.title }))}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        rows={releases.map((r) => ({
          id: r.id,
          version: r.version,
          name: r.name,
          type: r.type,
          environment: r.environment,
          releaseDate: r.releaseDate,
          ownerPersonId: r.ownerPersonId,
          ownerPersonName: r.ownerPerson?.name ?? null,
          relatedMilestoneId: r.relatedMilestoneId,
          relatedMilestoneName: r.relatedMilestone?.name ?? null,
          buildNumber: r.buildNumber,
          releaseNotes: r.releaseNotes,
          deploymentStatus: r.deploymentStatus,
          rollbackVersion: r.rollbackVersion,
          approvalStatus: r.approvalStatus,
          postReleaseValidation: r.postReleaseValidation,
          knownIssues: r.knownIssues,
          uatSignoffStatus: r.uatSignoffStatus,
          uatSignoffDate: r.uatSignoffDate,
          uatFeedback: r.uatFeedback,
          sprintIds: r.sprints.map((s) => s.sprintId),
          wbsTaskIds: r.wbsTasks.map((t) => t.wbsTaskId),
        }))}
      />
    </div>
  );
}
