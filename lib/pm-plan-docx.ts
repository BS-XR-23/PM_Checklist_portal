import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { formatDate, formatShortDate } from "@/lib/format";
import { riskScore } from "@/lib/calculations";
import { STATUS_COLORS } from "@/lib/colors";
import type { ItemStatus } from "@/lib/constants";
import type { Project, PMPlan, StakeholderRow, CommsRow, RaciRow, RiskItem, DependencyItem, Milestone, DeliverableRow, TimelineRow, ResourceRow, GateRow } from "@prisma/client";

function milestoneStatusLabel(status: string): string {
  return STATUS_COLORS[status as ItemStatus]?.label ?? status;
}

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "pmp-plan-template.docx");

export type PmPlanExportData = {
  project: Project;
  pmPlan: PMPlan;
  stakeholders: StakeholderRow[];
  comms: CommsRow[];
  raci: RaciRow[];
  risks: RiskItem[];
  dependencies: DependencyItem[];
  milestones: (Milestone & { ownerPerson: { name: string } | null })[];
  deliverables: DeliverableRow[];
  timeline: TimelineRow[];
  resources: ResourceRow[];
  gates: GateRow[];
};

export function renderPmPlanDocx({ project, pmPlan, stakeholders, comms, raci, risks, dependencies, milestones, deliverables, timeline, resources, gates }: PmPlanExportData): Buffer {
  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render({
    project_name: project.name,
    prepared_by: pmPlan.preparedBy ?? "",
    plan_date: formatDate(pmPlan.planDate),
    version: pmPlan.version,
    rationale: pmPlan.rationale ?? "",

    charter_objective: pmPlan.charterObjective ?? "",
    charter_scope_in: pmPlan.charterScopeIn ?? "",
    charter_scope_out: pmPlan.charterScopeOut ?? "",
    charter_success_criteria: pmPlan.charterSuccessCriteria ?? "",
    charter_timeline: pmPlan.charterTimeline ?? "",
    charter_budget: pmPlan.charterBudget ?? "",
    charter_assumptions: pmPlan.charterAssumptions ?? "",
    charter_pm_authority: pmPlan.charterPmAuthority ?? "",

    method_approach: pmPlan.methodApproach ?? "",
    method_cadence: pmPlan.methodCadence ?? "",
    method_ceremonies: pmPlan.methodCeremonies ?? "",
    method_tools: pmPlan.methodTools ?? "",
    method_roles: pmPlan.methodRoles ?? "",
    method_change_mgmt: pmPlan.methodChangeMgmt ?? "",

    test_levels: pmPlan.testLevels ?? "",
    test_environments: pmPlan.testEnvironments ?? "",
    test_entry_criteria: pmPlan.testEntryCriteria ?? "",
    test_exit_criteria: pmPlan.testExitCriteria ?? "",
    test_defect_mgmt: pmPlan.testDefectMgmt ?? "",
    test_uat_process: pmPlan.testUatProcess ?? "",
    test_deliverables: pmPlan.testDeliverables ?? "",

    deploy_environments: pmPlan.deployEnvironments ?? "",
    deploy_release_strategy: pmPlan.deployReleaseStrategy ?? "",
    deploy_steps: pmPlan.deploySteps ?? "",
    deploy_rollback: pmPlan.deployRollback ?? "",
    deploy_golive_checklist: pmPlan.deployGoliveChecklist ?? "",
    deploy_monitoring: pmPlan.deployMonitoring ?? "",

    escalation_path: pmPlan.escalationPath ?? "",

    stakeholders: stakeholders
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ stakeholder: s.stakeholder, role: s.role, responsibility: s.responsibility, accessRequired: s.accessRequired })),
    comms: comms
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ audience: c.audience, frequency: c.frequency, channel: c.channel, content: c.content })),
    raci: raci
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ activity: r.activity, pm: r.pm, tl: r.tl, ba: r.ba, leadEng: r.leadEng, creativeLead: r.creativeLead })),
    risks: risks
      .sort((a, b) => a.order - b.order)
      .map((r, i) => ({
        num: String(i + 1),
        type: r.type,
        description: r.description,
        probability: r.probability,
        impact: r.impact,
        score: String(riskScore(r.probability, r.impact)),
        response: r.mitigation ?? "",
        owner: r.owner ?? "",
        status: r.status,
      })),
    dependencies: dependencies
      .sort((a, b) => a.order - b.order)
      .map((d, i) => ({
        num: String(i + 1),
        category: d.category ?? "",
        description: d.description,
        responsible: d.responsible ?? "",
        priority: d.priority,
        expectedDate: formatShortDate(d.expectedDate),
        status: d.status,
      })),
    deliverables: deliverables
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ deliverable: d.deliverable, acceptanceEvidence: d.acceptanceEvidence, owner: d.owner, target: d.target })),
    milestones: milestones.map((m) => ({
      name: m.name,
      target: formatShortDate(m.plannedDate),
      owner: m.ownerPerson?.name ?? "",
      exitCriteria: m.acceptanceCriteria ?? "",
      status: milestoneStatusLabel(m.status),
    })),
    timeline: timeline
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ phase: t.phase, start: t.start, end: t.end, status: t.status })),
    resources: resources
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ role: r.role, allocation: r.allocation, responsibility: r.responsibility, backup: r.backup })),
    gates: gates
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ gate: g.gate, requiredEvidence: g.requiredEvidence, exitCondition: g.exitCondition, status: g.status })),
  });

  return doc.getZip().generate({ type: "nodebuffer" });
}
