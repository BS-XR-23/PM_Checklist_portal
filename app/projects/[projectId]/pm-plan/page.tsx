import { prisma } from "@/lib/prisma";
import { toDateInputValue, formatDate } from "@/lib/format";
import { requireModuleAccess } from "@/lib/rbac";
import { PlanField } from "@/components/pm-plan/plan-field";
import { ProjectDetailsFields } from "@/components/pm-plan/project-details-fields";
import { StakeholdersTable } from "@/components/pm-plan/stakeholders-table";
import { CommsTable } from "@/components/pm-plan/comms-table";
import { RaciTable } from "@/components/pm-plan/raci-table";

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
      },
    }),
    canWrite ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const projectId = params.projectId;
  const pmPlanId = pmPlan.id;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Project Management Plan</h2>
          <p className="text-sm text-slate-500">
            Generated from the BS23 PMP_Template.docx — 8 sections{canWrite ? ", editable here, exportable back to the same .docx." : "."}
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
        {canWrite ? (
          <ProjectDetailsFields pmPlanId={pmPlanId} projectId={projectId} preparedBy={pmPlan.preparedBy ?? ""} planDate={toDateInputValue(pmPlan.planDate)} version={pmPlan.version} />
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <ReadOnlyField label="Prepared By" value={pmPlan.preparedBy} />
            <ReadOnlyField label="Date" value={formatDate(pmPlan.planDate)} />
            <ReadOnlyField label="Version" value={pmPlan.version} />
          </div>
        )}
      </Section>

      <Section title="1. Rationale" hint="Why this project is needed now, expected ROI, consequences of not proceeding, alignment with org goals.">
        {canWrite ? (
          <PlanField pmPlanId={pmPlanId} projectId={projectId} field="rationale" label="Rationale" value={pmPlan.rationale ?? ""} />
        ) : (
          <ReadOnlyField label="Rationale" value={pmPlan.rationale} />
        )}
      </Section>

      <Section title="2. Stakeholders & Access" hint="Add/remove rows per the actual project org chart. Define access levels per system.">
        {canWrite ? (
          <StakeholdersTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.stakeholders} people={people} />
        ) : (
          <ReadOnlyTable
            columns={["Stakeholder", "Role", "Responsibility", "Access Required"]}
            rows={pmPlan.stakeholders.map((r) => [r.stakeholder, r.role, r.responsibility, r.accessRequired])}
          />
        )}
      </Section>

      <Section title="3. Charter">
        {canWrite ? (
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
        ) : (
          <div className="space-y-3">
            <ReadOnlyField label="Objective" value={pmPlan.charterObjective} />
            <ReadOnlyField label="Scope (In)" value={pmPlan.charterScopeIn} />
            <ReadOnlyField label="Scope (Out)" value={pmPlan.charterScopeOut} />
            <ReadOnlyField label="Success Criteria" value={pmPlan.charterSuccessCriteria} />
            <ReadOnlyField label="Timeline" value={pmPlan.charterTimeline} />
            <ReadOnlyField label="Budget" value={pmPlan.charterBudget} />
            <ReadOnlyField label="Assumptions & Constraints" value={pmPlan.charterAssumptions} />
            <ReadOnlyField label="PM Authority" value={pmPlan.charterPmAuthority} />
          </div>
        )}
      </Section>

      <Section title="4. Methodology">
        {canWrite ? (
          <div className="space-y-3">
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodApproach" label="Approach" value={pmPlan.methodApproach ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodCadence" label="Cadence" value={pmPlan.methodCadence ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodCeremonies" label="Ceremonies" value={pmPlan.methodCeremonies ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodTools" label="Tools" value={pmPlan.methodTools ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodRoles" label="Roles" value={pmPlan.methodRoles ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="methodChangeMgmt" label="Change Management" value={pmPlan.methodChangeMgmt ?? ""} />
          </div>
        ) : (
          <div className="space-y-3">
            <ReadOnlyField label="Approach" value={pmPlan.methodApproach} />
            <ReadOnlyField label="Cadence" value={pmPlan.methodCadence} />
            <ReadOnlyField label="Ceremonies" value={pmPlan.methodCeremonies} />
            <ReadOnlyField label="Tools" value={pmPlan.methodTools} />
            <ReadOnlyField label="Roles" value={pmPlan.methodRoles} />
            <ReadOnlyField label="Change Management" value={pmPlan.methodChangeMgmt} />
          </div>
        )}
      </Section>

      <Section title="5. Test Plan">
        {canWrite ? (
          <div className="space-y-3">
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testLevels" label="Testing Levels" value={pmPlan.testLevels ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testEnvironments" label="Test Environments" value={pmPlan.testEnvironments ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testEntryCriteria" label="Entry Criteria" value={pmPlan.testEntryCriteria ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testExitCriteria" label="Exit Criteria" value={pmPlan.testExitCriteria ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testDefectMgmt" label="Defect Management" value={pmPlan.testDefectMgmt ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testUatProcess" label="UAT Process" value={pmPlan.testUatProcess ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="testDeliverables" label="Test Deliverables" value={pmPlan.testDeliverables ?? ""} />
          </div>
        ) : (
          <div className="space-y-3">
            <ReadOnlyField label="Testing Levels" value={pmPlan.testLevels} />
            <ReadOnlyField label="Test Environments" value={pmPlan.testEnvironments} />
            <ReadOnlyField label="Entry Criteria" value={pmPlan.testEntryCriteria} />
            <ReadOnlyField label="Exit Criteria" value={pmPlan.testExitCriteria} />
            <ReadOnlyField label="Defect Management" value={pmPlan.testDefectMgmt} />
            <ReadOnlyField label="UAT Process" value={pmPlan.testUatProcess} />
            <ReadOnlyField label="Test Deliverables" value={pmPlan.testDeliverables} />
          </div>
        )}
      </Section>

      <Section title="6. Deployment Plan">
        {canWrite ? (
          <div className="space-y-3">
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployEnvironments" label="Environments" value={pmPlan.deployEnvironments ?? ""} multiline={false} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployReleaseStrategy" label="Release Strategy" value={pmPlan.deployReleaseStrategy ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deploySteps" label="Deployment Steps" value={pmPlan.deploySteps ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployRollback" label="Rollback Plan" value={pmPlan.deployRollback ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployGoliveChecklist" label="Go-Live Checklist" value={pmPlan.deployGoliveChecklist ?? ""} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="deployMonitoring" label="Post-Deployment Monitoring" value={pmPlan.deployMonitoring ?? ""} />
          </div>
        ) : (
          <div className="space-y-3">
            <ReadOnlyField label="Environments" value={pmPlan.deployEnvironments} />
            <ReadOnlyField label="Release Strategy" value={pmPlan.deployReleaseStrategy} />
            <ReadOnlyField label="Deployment Steps" value={pmPlan.deploySteps} />
            <ReadOnlyField label="Rollback Plan" value={pmPlan.deployRollback} />
            <ReadOnlyField label="Go-Live Checklist" value={pmPlan.deployGoliveChecklist} />
            <ReadOnlyField label="Post-Deployment Monitoring" value={pmPlan.deployMonitoring} />
          </div>
        )}
      </Section>

      <Section title="7. Communications Plan" hint="Include an escalation path: who to contact and how, for urgent issues.">
        {canWrite ? (
          <div className="space-y-4">
            <CommsTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.commsRows} />
            <PlanField pmPlanId={pmPlanId} projectId={projectId} field="escalationPath" label="Escalation Path" value={pmPlan.escalationPath ?? ""} />
          </div>
        ) : (
          <div className="space-y-4">
            <ReadOnlyTable columns={["Audience", "Frequency", "Channel", "Content"]} rows={pmPlan.commsRows.map((r) => [r.audience, r.frequency, r.channel, r.content])} />
            <ReadOnlyField label="Escalation Path" value={pmPlan.escalationPath} />
          </div>
        )}
      </Section>

      <Section title="8. RACI Matrix" hint="Legend: R = Responsible, A = Accountable, C = Consulted, I = Informed.">
        {canWrite ? (
          <RaciTable pmPlanId={pmPlanId} projectId={projectId} rows={pmPlan.raciRows} />
        ) : (
          <ReadOnlyTable
            columns={["Activity", "PM", "TL", "BA", "Lead Eng.", "Creative Lead"]}
            rows={pmPlan.raciRows.map((r) => [r.activity, r.pm, r.tl, r.ba, r.leadEng, r.creativeLead])}
          />
        )}
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

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

function ReadOnlyTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
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
