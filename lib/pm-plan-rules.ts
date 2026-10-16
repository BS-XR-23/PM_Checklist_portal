// Pure rules for the PM Plan: which fields and row columns a save may touch
// (server actions take whatever the browser sends, so anything not listed
// here is refused), the allowed status values, and how far each section
// really is — "has a row" isn't "done" when every new project starts with
// template rows.

export const PM_PLAN_SCALAR_FIELDS = [
  "preparedBy",
  "planDate",
  "version",
  "rationale",
  "charterObjective",
  "charterScopeIn",
  "charterScopeOut",
  "charterSuccessCriteria",
  "charterTimeline",
  "charterBudget",
  "charterAssumptions",
  "charterPmAuthority",
  "methodApproach",
  "methodCadence",
  "methodCeremonies",
  "methodTools",
  "methodRoles",
  "methodChangeMgmt",
  "testLevels",
  "testEnvironments",
  "testEntryCriteria",
  "testExitCriteria",
  "testDefectMgmt",
  "testUatProcess",
  "testDeliverables",
  "deployEnvironments",
  "deployReleaseStrategy",
  "deploySteps",
  "deployRollback",
  "deployGoliveChecklist",
  "deployMonitoring",
  "escalationPath",
] as const;
export type PmPlanScalarField = (typeof PM_PLAN_SCALAR_FIELDS)[number];

export function isPmPlanScalarField(field: string): field is PmPlanScalarField {
  return (PM_PLAN_SCALAR_FIELDS as readonly string[]).includes(field);
}

/** Money in the plan — hidden from read-limited viewers like every other financial field. */
export const PM_PLAN_FINANCIAL_FIELDS: readonly PmPlanScalarField[] = ["charterBudget"];

export const TIMELINE_STATUSES = ["Not Started", "In Progress", "Completed"] as const;
export const GATE_STATUSES = ["Not Started", "In Progress", "Approved"] as const;
export const INFLUENCE_LEVELS = ["Low", "Medium", "High"] as const;

// Editable columns per PM Plan table — never pmPlanId/id/order, so a save
// can't move a row into another project's plan.
export const PM_PLAN_ROW_FIELDS = {
  stakeholder: ["stakeholder", "personId", "role", "responsibility", "accessRequired", "influence", "interest"],
  comms: ["audience", "frequency", "channel", "content", "personId"],
  raci: ["activity", "pm", "tl", "ba", "leadEng", "creativeLead"],
  timeline: ["phase", "start", "end", "status"],
  deliverable: ["deliverable", "acceptanceEvidence", "owner", "target"],
  resource: ["role", "allocation", "responsibility", "backup"],
  gate: ["gate", "requiredEvidence", "exitCondition", "status"],
} as const;
export type PmPlanRowKind = keyof typeof PM_PLAN_ROW_FIELDS;

/**
 * Keeps only the columns this table allows, and checks the ones with a
 * fixed set of values. Throws on anything else rather than silently
 * dropping it, so a bad save is visible.
 */
export function cleanRowUpdate(kind: PmPlanRowKind, data: Record<string, unknown>): Record<string, string | null> {
  const allowed = PM_PLAN_ROW_FIELDS[kind] as readonly string[];
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.includes(key)) throw new Error(`"${key}" can't be changed on this table.`);
    if (key === "personId") {
      if (value !== null && typeof value !== "string") throw new Error("Invalid person.");
      out.personId = (value as string | null) || null;
      continue;
    }
    if (typeof value !== "string") throw new Error(`"${key}" must be text.`);
    if (key === "status") {
      const statuses = kind === "gate" ? GATE_STATUSES : TIMELINE_STATUSES;
      if (!(statuses as readonly string[]).includes(value)) throw new Error(`Unknown status "${value}".`);
    }
    if ((key === "influence" || key === "interest") && !(INFLUENCE_LEVELS as readonly string[]).includes(value)) {
      throw new Error(`Unknown level "${value}".`);
    }
    if ((key === "start" || key === "end") && value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must be YYYY-MM-DD.");
    out[key] = value;
  }
  return out;
}

export type SectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

/** 0 filled = Not Started, all filled = Completed, anything between = In Progress. */
export function statusFromCounts(filled: number, total: number): SectionStatus {
  if (filled <= 0) return "NOT_STARTED";
  if (filled >= total) return "COMPLETED";
  return "IN_PROGRESS";
}

const filledText = (s: string | null | undefined) => !!s && s.trim() !== "";

// New rows are created with these placeholder names — a phase still called
// "New phase 2" hasn't really been planned yet.
const PLACEHOLDER_NAME = /^new (stakeholder|audience|activity|phase|deliverable|role|gate)\b/i;
const isRealName = (s: string) => filledText(s) && !PLACEHOLDER_NAME.test(s.trim());

/** Stakeholders: rows tied to a real person, not the generic template roles every project starts with. */
export function stakeholderProgress(rows: { stakeholder: string; personId: string | null }[]) {
  const filled = rows.filter((r) => r.personId && isRealName(r.stakeholder)).length;
  return { status: statusFromCounts(filled, Math.max(rows.length, 1)), label: `${filled}/${rows.length} linked to a person` };
}

/** Timeline: phases with a real name and both dates. */
export function timelineProgress(rows: { phase: string; start: string; end: string }[]) {
  const filled = rows.filter((r) => isRealName(r.phase) && filledText(r.start) && filledText(r.end)).length;
  return { status: statusFromCounts(filled, Math.max(rows.length, 1)), label: `${rows.length} ${rows.length === 1 ? "phase" : "phases"}` };
}

/** Deliverables: each needs acceptance evidence and a target. */
export function deliverableProgress(rows: { deliverable: string; acceptanceEvidence: string; target: string }[]) {
  const filled = rows.filter((r) => isRealName(r.deliverable) && filledText(r.acceptanceEvidence) && filledText(r.target)).length;
  return { status: statusFromCounts(filled, Math.max(rows.length, 1)), label: `${rows.length} ${rows.length === 1 ? "deliverable" : "deliverables"}` };
}

/** Resources: each role needs an allocation. */
export function resourceProgress(rows: { role: string; allocation: string }[]) {
  const filled = rows.filter((r) => isRealName(r.role) && filledText(r.allocation)).length;
  return { status: statusFromCounts(filled, Math.max(rows.length, 1)), label: `${rows.length} ${rows.length === 1 ? "role" : "roles"}` };
}

/** Gates: progress is how many gates are approved — seven Not Started gates aren't a completed section. */
export function gateProgress(rows: { status: string }[]) {
  const approved = rows.filter((r) => r.status === "Approved").length;
  return { status: statusFromCounts(approved, Math.max(rows.length, 1)), label: rows.length ? `${approved}/${rows.length} approved` : "0 gates" };
}

/** Communications: needs an escalation path and at least one row aimed at a real person. */
export function commsProgress(rows: { personId: string | null }[], escalationPath: string | null) {
  const filled = (filledText(escalationPath) ? 1 : 0) + (rows.some((r) => r.personId) ? 1 : 0);
  return { status: statusFromCounts(filled, 2), label: `${rows.length} ${rows.length === 1 ? "row" : "rows"}` };
}
