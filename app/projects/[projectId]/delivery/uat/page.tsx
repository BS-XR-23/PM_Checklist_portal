import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import { PageGuide } from "@/components/ui/page-guide";
import { IconClipboardList, IconCheckCircle, IconAlertTriangle, IconClock } from "@/components/layout/icons";
import { formatPct } from "@/lib/format";
import { UatCasesTable } from "./uat-cases-table";
import { UatDefectsTable } from "./uat-defects-table";
import { AddUatCaseModal } from "./add-uat-case-modal";
import { AddUatDefectModal } from "./add-uat-defect-modal";

export const dynamic = "force-dynamic";

export default async function UatPage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const access = await requireModuleAccess(projectId, "UAT", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [cases, defects, releases, people] = await Promise.all([
    prisma.uatCase.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { ownerPerson: true, release: true } }),
    prisma.uatDefect.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, include: { ownerPerson: true, uatCase: true } }),
    prisma.release.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalCases = cases.length;
  const passedCases = cases.filter((c) => c.status === "PASSED").length;
  const failedCases = cases.filter((c) => c.status === "FAILED").length;
  const openDefects = defects.filter((d) => d.status !== "Closed" && d.status !== "Rejected");
  const criticalDefects = openDefects.filter((d) => d.severity === "Critical");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Delivery — UAT</h2>
        <p className="text-sm text-slate-500">
          Has the client/user accepted the delivered solution? Separate from internal QA — test cases, defects, and
          closure are tracked here per release/build.
        </p>
      </div>

      <PageGuide
        id="delivery-uat"
        title="How to fill this in"
        points={[
          <>Track each test case against the release/build it&apos;s validating — a case is only meaningful tied to a specific version.</>,
          <>When a case fails, log the defect and link it back to that case, so a fix can be traced to what it broke.</>,
          <><strong>Severity</strong> and <strong>Priority</strong> are separate on a defect: Severity is how bad the bug is, Priority is how soon it needs fixing — a low-severity bug can still be high priority.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconClipboardList />} iconWrapClass="bg-violet-50 text-violet-600" label="Test Cases" value={String(totalCases)} />
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="Passed"
          value={String(passedCases)}
          subtitle={totalCases ? formatPct(passedCases / totalCases) : undefined}
        />
        <StatTile icon={<IconAlertTriangle />} iconWrapClass="bg-rose-50 text-rose-600" label="Failed" value={String(failedCases)} />
        <StatTile icon={<IconClock />} iconWrapClass="bg-amber-50 text-amber-600" label="Open Defects" value={String(openDefects.length)} subtitle={`${criticalDefects.length} critical`} />
      </div>

      <div>
        <SectionHeader
          icon={<IconClipboardList />}
          iconWrapClass="bg-violet-50 text-violet-600"
          title="Test Scenarios / Cases"
          action={canWrite && <AddUatCaseModal projectId={projectId} releases={releases.map((r) => ({ id: r.id, label: `${r.version} — ${r.name}` }))} />}
        />
        <UatCasesTable
          projectId={projectId}
          canWrite={canWrite}
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          releases={releases.map((r) => ({ id: r.id, label: `${r.version} — ${r.name}` }))}
          rows={cases.map((c) => ({
            id: c.id,
            title: c.title,
            scenario: c.scenario,
            steps: c.steps,
            expectedResult: c.expectedResult,
            actualResult: c.actualResult,
            priority: c.priority,
            status: c.status,
            ownerPersonId: c.ownerPersonId,
            ownerPersonName: c.ownerPerson?.name ?? null,
            releaseId: c.releaseId,
            releaseLabel: c.release ? `${c.release.version} — ${c.release.name}` : null,
            notes: c.notes,
          }))}
        />
      </div>

      <div>
        <SectionHeader
          icon={<IconAlertTriangle />}
          iconWrapClass="bg-rose-50 text-rose-600"
          title="Defects"
          action={canWrite && <AddUatDefectModal projectId={projectId} cases={cases.map((c) => ({ id: c.id, title: c.title }))} />}
        />
        <UatDefectsTable
          projectId={projectId}
          canWrite={canWrite}
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          rows={defects.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            severity: d.severity,
            priority: d.priority,
            status: d.status,
            ownerPersonId: d.ownerPersonId,
            ownerPersonName: d.ownerPerson?.name ?? null,
            uatCaseTitle: d.uatCase?.title ?? null,
            targetFixDate: d.targetFixDate,
            retestResult: d.retestResult,
          }))}
        />
      </div>
    </div>
  );
}
