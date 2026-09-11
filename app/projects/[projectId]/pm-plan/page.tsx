import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/format";
import { requireModuleAccess } from "@/lib/rbac";
import { StatTile } from "@/components/ui/stat-tile";
import { PageGuide } from "@/components/ui/page-guide";
import { IconLayers, IconCheckCircle, IconClock, IconCircle, IconClipboardList } from "@/components/layout/icons";
import { PlanHeaderMeta } from "@/components/pm-plan/plan-header-meta";
import { PmPlanSections, type PmPlanSectionData, type PmPlanSectionStatus } from "@/components/pm-plan/pm-plan-sections";
import { PlanField } from "@/components/pm-plan/plan-field";
import { FieldLinkView } from "@/components/pm-plan/field-link-editor";
import { StakeholdersTable } from "@/components/pm-plan/stakeholders-table";
import { CommsTable } from "@/components/pm-plan/comms-table";
import { RaciTable } from "@/components/pm-plan/raci-table";
import type { PmPlanLinkableField } from "./pmplan-actions";

// filled/total -> a status band, reused by every section below: 0 filled is
// Not Started, all filled is Completed, anything between is In Progress. A
// single-field or single-list section (total 1) has no partial state, so it
// only ever lands on Not Started or Completed.
function statusFromCounts(filled: number, total: number): PmPlanSectionStatus {
  if (filled <= 0) return "NOT_STARTED";
  if (filled >= total) return "COMPLETED";
  return "IN_PROGRESS";
}

export default async function PmPlanPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "PM_PLAN", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const [pmPlan, people] = await Promise.all([
    prisma.pMPlan.findUniqueOrThrow({
      where: { projectId: params.projectId },
      include: {
        stakeholders: { orderBy: { order: "asc" } },
        commsRows: { orderBy: { order: "asc" } },
        raciRows: { orderBy: { order: "asc" } },
        links: true,
      },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const projectId = params.projectId;
  const pmPlanId = pmPlan.id;
  const linkByField = new Map(pmPlan.links.map((l) => [l.field, l.url]));
  const link = (field: PmPlanLinkableField) => linkByField.get(field) ?? null;

  const charterFields = [
    pmPlan.charterObjective,
    pmPlan.charterScopeIn,
    pmPlan.charterScopeOut,
    pmPlan.charterSuccessCriteria,
    pmPlan.charterTimeline,
    pmPlan.charterBudget,
    pmPlan.charterAssumptions,
    pmPlan.charterPmAuthority,
  ];
  const methodFields = [pmPlan.methodApproach, pmPlan.methodCadence, pmPlan.methodCeremonies, pmPlan.methodTools, pmPlan.methodRoles, pmPlan.methodChangeMgmt];
  const testFields = [
    pmPlan.testLevels,
    pmPlan.testEnvironments,
    pmPlan.testEntryCriteria,
    pmPlan.testExitCriteria,
    pmPlan.testDefectMgmt,
    pmPlan.testUatProcess,
    pmPlan.testDeliverables,
  ];
  const deployFields = [
    pmPlan.deployEnvironments,
    pmPlan.deployReleaseStrategy,
    pmPlan.deploySteps,
    pmPlan.deployRollback,
    pmPlan.deployGoliveChecklist,
    pmPlan.deployMonitoring,
  ];
  const filledCount = (fields: (string | null)[]) => fields.filter((f) => f && f.trim() !== "").length;
  const commsFilled = (pmPlan.commsRows.length > 0 ? 1 : 0) + (pmPlan.escalationPath ? 1 : 0);

  const sections: PmPlanSectionData[] = [
    {
      id: "rationale",
      number: 1,
      title: "Rationale",
      hint: "Why this project is needed now, expected ROI, consequences of not proceeding, alignment with org goals.",
      required: true,
      status: statusFromCounts(pmPlan.rationale ? 1 : 0, 1),
      view: <ReadOnlyField label="Rationale" value={pmPlan.rationale} link={link("rationale")} />,
      edit: canWrite ? (
        <PlanField
          pmPlanId={pmPlanId}
          projectId={projectId}
          field="rationale"
          label="Rationale"
          value={pmPlan.rationale ?? ""}
          linkField="rationale"
          linkUrl={link("rationale")}
        />
      ) : undefined,
    },
    {
      id: "stakeholders",
      number: 2,
      title: "Stakeholders & Access",
      hint: "Add/remove rows per the actual project org chart. Define access levels per system.",
      required: true,
      status: statusFromCounts(pmPlan.stakeholders.length, 1),
      itemCountLabel: `${pmPlan.stakeholders.length} ${pmPlan.stakeholders.length === 1 ? "stakeholder" : "stakeholders"}`,
      view: (
        <ReadOnlyTable
          columns={["Stakeholder", "Role", "Responsibility", "Access Required"]}
          rows={pmPlan.stakeholders.map((r) => [r.stakeholder, r.role, r.responsibility, r.accessRequired])}
        />
      ),
      edit: canWrite ? <StakeholdersTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.stakeholders} people={people} /> : undefined,
    },
    {
      id: "charter",
      number: 3,
      title: "Charter",
      required: true,
      status: statusFromCounts(filledCount(charterFields), charterFields.length),
      itemCountLabel: `${filledCount(charterFields)}/${charterFields.length} fields`,
      view: (
        <div className="space-y-3">
          <ReadOnlyField label="Objective" value={pmPlan.charterObjective} />
          <ReadOnlyField label="Scope (In)" value={pmPlan.charterScopeIn} link={link("charterScopeIn")} />
          <ReadOnlyField label="Scope (Out)" value={pmPlan.charterScopeOut} link={link("charterScopeOut")} />
          <ReadOnlyField label="Success Criteria" value={pmPlan.charterSuccessCriteria} link={link("charterSuccessCriteria")} />
          <ReadOnlyField label="Timeline" value={pmPlan.charterTimeline} link={link("charterTimeline")} />
          <ReadOnlyField label="Budget" value={pmPlan.charterBudget} />
          <ReadOnlyField label="Assumptions & Constraints" value={pmPlan.charterAssumptions} />
          <ReadOnlyField label="PM Authority" value={pmPlan.charterPmAuthority} />
        </div>
      ),
      edit: canWrite ? (
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterObjective" label="Objective" value={pmPlan.charterObjective ?? ""} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="charterScopeIn"
            label="Scope (In)"
            value={pmPlan.charterScopeIn ?? ""}
            linkField="charterScopeIn"
            linkUrl={link("charterScopeIn")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="charterScopeOut"
            label="Scope (Out)"
            value={pmPlan.charterScopeOut ?? ""}
            linkField="charterScopeOut"
            linkUrl={link("charterScopeOut")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="charterSuccessCriteria"
            label="Success Criteria"
            value={pmPlan.charterSuccessCriteria ?? ""}
            linkField="charterSuccessCriteria"
            linkUrl={link("charterSuccessCriteria")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="charterTimeline"
            label="Timeline"
            value={pmPlan.charterTimeline ?? ""}
            multiline={false}
            linkField="charterTimeline"
            linkUrl={link("charterTimeline")}
          />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterBudget" label="Budget" value={pmPlan.charterBudget ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterAssumptions" label="Assumptions & Constraints" value={pmPlan.charterAssumptions ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterPmAuthority" label="PM Authority" value={pmPlan.charterPmAuthority ?? ""} />
        </div>
      ) : undefined,
    },
    {
      id: "methodology",
      number: 4,
      title: "Methodology",
      status: statusFromCounts(filledCount(methodFields), methodFields.length),
      itemCountLabel: `${filledCount(methodFields)}/${methodFields.length} fields`,
      view: (
        <div className="space-y-3">
          <ReadOnlyField label="Approach" value={pmPlan.methodApproach} />
          <ReadOnlyField label="Cadence" value={pmPlan.methodCadence} />
          <ReadOnlyField label="Ceremonies" value={pmPlan.methodCeremonies} link={link("methodCeremonies")} />
          <ReadOnlyField label="Tools" value={pmPlan.methodTools} />
          <ReadOnlyField label="Roles" value={pmPlan.methodRoles} />
          <ReadOnlyField label="Change Management" value={pmPlan.methodChangeMgmt} link={link("methodChangeMgmt")} />
        </div>
      ),
      edit: canWrite ? (
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodApproach" label="Approach" value={pmPlan.methodApproach ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodCadence" label="Cadence" value={pmPlan.methodCadence ?? ""} multiline={false} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="methodCeremonies"
            label="Ceremonies"
            value={pmPlan.methodCeremonies ?? ""}
            linkField="methodCeremonies"
            linkUrl={link("methodCeremonies")}
          />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodTools" label="Tools" value={pmPlan.methodTools ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodRoles" label="Roles" value={pmPlan.methodRoles ?? ""} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="methodChangeMgmt"
            label="Change Management"
            value={pmPlan.methodChangeMgmt ?? ""}
            linkField="methodChangeMgmt"
            linkUrl={link("methodChangeMgmt")}
          />
        </div>
      ) : undefined,
    },
    {
      id: "test-plan",
      number: 5,
      title: "Test Plan",
      status: statusFromCounts(filledCount(testFields), testFields.length),
      itemCountLabel: `${filledCount(testFields)}/${testFields.length} fields`,
      view: (
        <div className="space-y-3">
          <ReadOnlyField label="Testing Levels" value={pmPlan.testLevels} />
          <ReadOnlyField label="Test Environments" value={pmPlan.testEnvironments} />
          <ReadOnlyField label="Entry Criteria" value={pmPlan.testEntryCriteria} link={link("testEntryCriteria")} />
          <ReadOnlyField label="Exit Criteria" value={pmPlan.testExitCriteria} link={link("testExitCriteria")} />
          <ReadOnlyField label="Defect Management" value={pmPlan.testDefectMgmt} link={link("testDefectMgmt")} />
          <ReadOnlyField label="UAT Process" value={pmPlan.testUatProcess} link={link("testUatProcess")} />
          <ReadOnlyField label="Test Deliverables" value={pmPlan.testDeliverables} link={link("testDeliverables")} />
        </div>
      ),
      edit: canWrite ? (
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testLevels" label="Testing Levels" value={pmPlan.testLevels ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testEnvironments" label="Test Environments" value={pmPlan.testEnvironments ?? ""} multiline={false} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="testEntryCriteria"
            label="Entry Criteria"
            value={pmPlan.testEntryCriteria ?? ""}
            linkField="testEntryCriteria"
            linkUrl={link("testEntryCriteria")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="testExitCriteria"
            label="Exit Criteria"
            value={pmPlan.testExitCriteria ?? ""}
            linkField="testExitCriteria"
            linkUrl={link("testExitCriteria")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="testDefectMgmt"
            label="Defect Management"
            value={pmPlan.testDefectMgmt ?? ""}
            linkField="testDefectMgmt"
            linkUrl={link("testDefectMgmt")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="testUatProcess"
            label="UAT Process"
            value={pmPlan.testUatProcess ?? ""}
            linkField="testUatProcess"
            linkUrl={link("testUatProcess")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="testDeliverables"
            label="Test Deliverables"
            value={pmPlan.testDeliverables ?? ""}
            linkField="testDeliverables"
            linkUrl={link("testDeliverables")}
          />
        </div>
      ) : undefined,
    },
    {
      id: "deployment-plan",
      number: 6,
      title: "Deployment Plan",
      status: statusFromCounts(filledCount(deployFields), deployFields.length),
      itemCountLabel: `${filledCount(deployFields)}/${deployFields.length} fields`,
      view: (
        <div className="space-y-3">
          <ReadOnlyField label="Environments" value={pmPlan.deployEnvironments} />
          <ReadOnlyField label="Release Strategy" value={pmPlan.deployReleaseStrategy} />
          <ReadOnlyField label="Deployment Steps" value={pmPlan.deploySteps} link={link("deploySteps")} />
          <ReadOnlyField label="Rollback Plan" value={pmPlan.deployRollback} link={link("deployRollback")} />
          <ReadOnlyField label="Go-Live Checklist" value={pmPlan.deployGoliveChecklist} link={link("deployGoliveChecklist")} />
          <ReadOnlyField label="Post-Deployment Monitoring" value={pmPlan.deployMonitoring} link={link("deployMonitoring")} />
        </div>
      ),
      edit: canWrite ? (
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployEnvironments" label="Environments" value={pmPlan.deployEnvironments ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployReleaseStrategy" label="Release Strategy" value={pmPlan.deployReleaseStrategy ?? ""} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="deploySteps"
            label="Deployment Steps"
            value={pmPlan.deploySteps ?? ""}
            linkField="deploySteps"
            linkUrl={link("deploySteps")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="deployRollback"
            label="Rollback Plan"
            value={pmPlan.deployRollback ?? ""}
            linkField="deployRollback"
            linkUrl={link("deployRollback")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="deployGoliveChecklist"
            label="Go-Live Checklist"
            value={pmPlan.deployGoliveChecklist ?? ""}
            linkField="deployGoliveChecklist"
            linkUrl={link("deployGoliveChecklist")}
          />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="deployMonitoring"
            label="Post-Deployment Monitoring"
            value={pmPlan.deployMonitoring ?? ""}
            linkField="deployMonitoring"
            linkUrl={link("deployMonitoring")}
          />
        </div>
      ) : undefined,
    },
    {
      id: "communications-plan",
      number: 7,
      title: "Communications Plan",
      hint: "Include an escalation path: who to contact and how, for urgent issues.",
      status: statusFromCounts(commsFilled, 2),
      itemCountLabel: `${pmPlan.commsRows.length} ${pmPlan.commsRows.length === 1 ? "row" : "rows"}`,
      view: (
        <div className="space-y-4">
          <ReadOnlyTable columns={["Audience", "Frequency", "Channel", "Content"]} rows={pmPlan.commsRows.map((r) => [r.audience, r.frequency, r.channel, r.content])} />
          <ReadOnlyField label="Escalation Path" value={pmPlan.escalationPath} link={link("escalationPath")} />
        </div>
      ),
      edit: canWrite ? (
        <div className="space-y-4">
          <CommsTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.commsRows} />
          <PlanField
            pmPlanId={pmPlanId}
            projectId={projectId}
            field="escalationPath"
            label="Escalation Path"
            value={pmPlan.escalationPath ?? ""}
            linkField="escalationPath"
            linkUrl={link("escalationPath")}
          />
        </div>
      ) : undefined,
    },
    {
      id: "raci-matrix",
      number: 8,
      title: "RACI Matrix",
      hint: "Legend: R = Responsible, A = Accountable, C = Consulted, I = Informed.",
      required: true,
      status: statusFromCounts(pmPlan.raciRows.length, 1),
      itemCountLabel: `${pmPlan.raciRows.length} ${pmPlan.raciRows.length === 1 ? "activity" : "activities"}`,
      view: (
        <ReadOnlyTable
          columns={["Activity", "PM", "TL", "BA", "Lead Eng.", "Creative Lead"]}
          rows={pmPlan.raciRows.map((r) => [r.activity, r.pm, r.tl, r.ba, r.leadEng, r.creativeLead])}
        />
      ),
      edit: canWrite ? <RaciTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.raciRows} /> : undefined,
    },
  ];

  const completedCount = sections.filter((s) => s.status === "COMPLETED").length;
  const inProgressCount = sections.filter((s) => s.status === "IN_PROGRESS").length;
  const notStartedCount = sections.filter((s) => s.status === "NOT_STARTED").length;
  const dataRows = pmPlan.stakeholders.length + pmPlan.commsRows.length + pmPlan.raciRows.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Project Management Plan</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Comprehensive plan that defines how the project will be executed, monitored, and controlled to deliver the intended outcomes.
            </p>
          </div>
          <a
            href={`/api/projects/${projectId}/pm-plan/export`}
            className="rounded-md bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 shrink-0"
          >
            Export .docx
          </a>
        </div>

        <PlanHeaderMeta
          pmPlanId={pmPlanId}
          projectId={projectId}
          preparedBy={pmPlan.preparedBy}
          planDate={toDateInputValue(pmPlan.planDate)}
          version={pmPlan.version}
          updatedAt={pmPlan.updatedAt}
          canWrite={canWrite}
        />
      </div>

      <PageGuide
        id="pm-plan"
        title="How this page works"
        points={[
          <>Each section has its own hint text under its title for what belongs there — worth a read before filling in the bundled ones like Charter, Method, Test, or Deploy.</>,
          <>&quot;Required&quot; is a labeling convention, not an enforced gate — nothing blocks the project if a required section is left empty.</>,
          <>Completed / In Progress / Not Started just counts how many fields in a section are filled in — it&apos;s not a sign-off or approval status.</>,
          <>Export .docx turns the whole plan into a formatted document, as it stands right now.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Sections" value={String(sections.length)} />
        <StatTile icon={<IconCheckCircle />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Completed" value={String(completedCount)} />
        <StatTile icon={<IconClock />} iconWrapClass="bg-amber-50 text-amber-600" label="In Progress" value={String(inProgressCount)} />
        <StatTile icon={<IconCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Not Started" value={String(notStartedCount)} />
      </div>

      <PmPlanSections sections={sections} canWrite={canWrite} />

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <IconClipboardList className="h-3.5 w-3.5" />
        Generated from the BS23 PMP_Template.docx — {dataRows} data rows across Stakeholders, Communications, and RACI.
      </p>
    </div>
  );
}

function ReadOnlyField({ label, value, link }: { label: string; value: string | null; link?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value || "—"}</p>
      <FieldLinkView url={link} />
    </div>
  );
}

function ReadOnlyTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No rows yet.</p>;
  }
  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-slate-700">
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
