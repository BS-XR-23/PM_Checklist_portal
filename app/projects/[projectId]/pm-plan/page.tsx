import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/format";
import { PlanField } from "@/components/pm-plan/plan-field";
import { ProjectDetailsFields } from "@/components/pm-plan/project-details-fields";
import { StakeholdersTable } from "@/components/pm-plan/stakeholders-table";
import { CommsTable } from "@/components/pm-plan/comms-table";
import { RaciTable } from "@/components/pm-plan/raci-table";

export default async function PmPlanPage({ params }: { params: { projectId: string } }) {
  const pmPlan = await prisma.pMPlan.findUniqueOrThrow({
    where: { projectId: params.projectId },
    include: {
      stakeholders: { orderBy: { order: "asc" } },
      commsRows: { orderBy: { order: "asc" } },
      raciRows: { orderBy: { order: "asc" } },
    },
  });

  const projectId = params.projectId;
  const pmPlanId = pmPlan.id;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Project Management Plan</h2>
          <p className="text-sm text-slate-500">
            Generated from the BS23 PMP_Template.docx — 8 sections, editable here, exportable back to the same .docx.
          </p>
        </div>
        <a
          href={`/api/projects/${projectId}/pm-plan/export`}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 shrink-0"
        >
          Export .docx
        </a>
      </div>

      <Section title="Project Details">
        <ProjectDetailsFields
          pmPlanId={pmPlanId}
          projectId={projectId}
          preparedBy={pmPlan.preparedBy ?? ""}
          planDate={toDateInputValue(pmPlan.planDate)}
          version={pmPlan.version}
        />
      </Section>

      <Section title="1. Rationale" hint="Why this project is needed now, expected ROI, consequences of not proceeding, alignment with org goals.">
        <PlanField pmPlanId={pmPlanId} projectId={projectId} field="rationale" label="Rationale" value={pmPlan.rationale ?? ""} />
      </Section>

      <Section title="2. Stakeholders & Access" hint="Add/remove rows per the actual project org chart. Define access levels per system.">
        <StakeholdersTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.stakeholders} />
      </Section>

      <Section title="3. Charter">
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterObjective" label="Objective" value={pmPlan.charterObjective ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterScopeIn" label="Scope (In)" value={pmPlan.charterScopeIn ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterScopeOut" label="Scope (Out)" value={pmPlan.charterScopeOut ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterSuccessCriteria" label="Success Criteria" value={pmPlan.charterSuccessCriteria ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterTimeline" label="Timeline" value={pmPlan.charterTimeline ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterBudget" label="Budget" value={pmPlan.charterBudget ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterAssumptions" label="Assumptions & Constraints" value={pmPlan.charterAssumptions ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="charterPmAuthority" label="PM Authority" value={pmPlan.charterPmAuthority ?? ""} />
        </div>
      </Section>

      <Section title="4. Methodology">
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodApproach" label="Approach" value={pmPlan.methodApproach ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodCadence" label="Cadence" value={pmPlan.methodCadence ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodCeremonies" label="Ceremonies" value={pmPlan.methodCeremonies ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodTools" label="Tools" value={pmPlan.methodTools ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodRoles" label="Roles" value={pmPlan.methodRoles ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodChangeMgmt" label="Change Management" value={pmPlan.methodChangeMgmt ?? ""} />
        </div>
      </Section>

      <Section title="5. Test Plan">
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testLevels" label="Testing Levels" value={pmPlan.testLevels ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testEnvironments" label="Test Environments" value={pmPlan.testEnvironments ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testEntryCriteria" label="Entry Criteria" value={pmPlan.testEntryCriteria ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testExitCriteria" label="Exit Criteria" value={pmPlan.testExitCriteria ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testDefectMgmt" label="Defect Management" value={pmPlan.testDefectMgmt ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testUatProcess" label="UAT Process" value={pmPlan.testUatProcess ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testDeliverables" label="Test Deliverables" value={pmPlan.testDeliverables ?? ""} />
        </div>
      </Section>

      <Section title="6. Deployment Plan">
        <div className="space-y-3">
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployEnvironments" label="Environments" value={pmPlan.deployEnvironments ?? ""} multiline={false} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployReleaseStrategy" label="Release Strategy" value={pmPlan.deployReleaseStrategy ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deploySteps" label="Deployment Steps" value={pmPlan.deploySteps ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployRollback" label="Rollback Plan" value={pmPlan.deployRollback ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployGoliveChecklist" label="Go-Live Checklist" value={pmPlan.deployGoliveChecklist ?? ""} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployMonitoring" label="Post-Deployment Monitoring" value={pmPlan.deployMonitoring ?? ""} />
        </div>
      </Section>

      <Section title="7. Communications Plan" hint="Include an escalation path: who to contact and how, for urgent issues.">
        <div className="space-y-4">
          <CommsTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.commsRows} />
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="escalationPath" label="Escalation Path" value={pmPlan.escalationPath ?? ""} />
        </div>
      </Section>

      <Section title="8. RACI Matrix" hint="Legend: R = Responsible, A = Accountable, C = Consulted, I = Informed.">
        <RaciTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.raciRows} />
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {hint && <p className="text-xs text-slate-500 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
