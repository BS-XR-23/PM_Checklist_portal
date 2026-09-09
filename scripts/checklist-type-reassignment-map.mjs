// One-off local generator (never touches the DB) — reads the approved
// (oldType, oldOrder) -> (newType, newStage) mapping and emits:
//   1. the new per-type seed arrays for lib/seed-data.ts
//   2. the UPDATE statements for the Prisma migration SQL
// Run with: node checklist-type-reassignment-map.mjs
//
// This is kept only as a record of the mapping (e.g. to build an inverse
// migration if a mistake surfaces later — swap old/new in each row and
// rerun). Running it writes two scratch files into this directory
// (checklist-migration.sql, checklist-seed-arrays.ts) that were already
// copied by hand into prisma/migrations/.../migration.sql and
// lib/seed-data.ts respectively — delete both after reviewing a rerun's
// output, since checklist-seed-arrays.ts has no import for
// ChecklistSeedItem and will fail `tsc` if left sitting in scripts/.

// itemText is carried only for human review of this script's output — the
// actual UPDATE statements key strictly on (oldType, oldOrder), never on text.
//
// A 5th element (newOrder) is given ONLY for rows moving into DEVOPS, since
// that's the one destination type with pre-existing rows (1-18) — moving a
// PM row there while keeping its old order collides with the
// ChecklistTemplateItem/ChecklistItem unique(type, order) constraint
// (confirmed the hard way: Postgres rejected order=5 landing on top of
// DevOps's existing order=5 row). ENGINEERING/QA/CREATIVE_XR start with zero
// rows, so moves into those three are safe at their original order with no
// override needed.
const PM_MAP = [
  [1, "Collect RFP, Proposal, and Contract/PO copies", "PM", "Governance"],
  [2, "Send project initiation email to assigned PM", "PM", "Governance"],
  [3, "Confirm client-approved platforms and performance expectations (Quest/Vision Pro/WebXR/AR/PCVR)", "PM", "Governance"],
  [4, "Create MS Teams channel and SharePoint space for the project", "PM", "Governance"],
  [5, "Create Git repository for code AND set up asset version control (Git LFS / DAM) for large 3D files", "DEVOPS", "Infrastructure", 19],
  [6, "Complete and approve Definition of Ready (DoR)", "PM", "Planning"],
  [7, "Draft Project Management Plan (use PMP_Template.docx)", "PM", "Planning"],
  [8, "Define fixed-budget contingency/buffer percentage in the PM Plan", "PM", "Planning"],
  [9, "Define CR pricing basis (man-day rate used for paid change requests)", "PM", "Planning"],
  [10, "Define budget/schedule overrun escalation thresholds", "PM", "Planning"],
  [11, "Development estimation of Epics in story points", "PM", "Planning"],
  [12, "Build WBS Level 1", "PM", "Planning"],
  [13, "Map each milestone (~1 month cadence) to a payment tranche in the schedule", "PM", "Baselines"],
  [14, "Set up WBS ID <-> SRS traceability (Product Backlog)", "PM", "Planning"],
  [15, "Approve experience flow & interaction map", "CREATIVE_XR", "UX"],
  [16, "Define 3D assets plan; plan and validate environment graybox", "CREATIVE_XR", "3D"],
  [17, "Prepare Figma / 3D UX mockups", "CREATIVE_XR", "UX"],
  [18, "Define Definition of Done (DoD) checklist, including XR-specific criteria", "QA", "Test Planning"],
  [19, "Hold project kickoff meeting with client present", "PM", "Gates"],
  [20, "Share SRS with estimation with client", "PM", "Approvals"],
  [21, "Review and confirm payment terms and schedule", "PM", "Baselines"],
  [22, "Upload final pre-development documents to the project repository", "PM", "Planning"],
  [23, "Run Creative Huddle workshop with client", "CREATIVE_XR", "Storyboard"],
  [24, "Finalize Experience Flow / storyboard", "CREATIVE_XR", "Storyboard"],
  [25, "Approve Visual Style Reference (mood board, sample assets)", "CREATIVE_XR", "Assets"],
  [26, "Confirm Feature Definition Sheet and scope boundaries with client", "PM", "Baselines"],
  [27, "Hold backlog refinement / release planning meeting; add signed CRs to WBS", "PM", "Planning"],
  [28, "Hold sprint planning meeting; send SRS Sprint PDF to client", "PM", "Planning"],
  [29, "Log daily standups and time entries in PM tool", "PM", "Governance"],
  [30, "Run automated AI code review (Git Action) on every PR; senior dev manual review before merge", "ENGINEERING", "Code Review"],
  [31, "Run device-level testing each sprint (FPS, draw calls, shader complexity)", "QA", "Device Testing"],
  [32, "Run comfort & accessibility QA each sprint", "QA", "Functional Testing"],
  [33, "Validate asset imports; test API integration on staging; implement error handling/fallback", "ENGINEERING", "Development"],
  [34, "Execute test cases; log and retest defects", "QA", "Functional Testing"],
  [35, "Record and share sprint review demo with client and stakeholders", "PM", "Governance"],
  [36, "Update CPI/SPI report weekly; escalate if beyond defined threshold", "PM", "Governance"],
  [37, "Hold sprint retrospective (minimum monthly)", "PM", "Governance"],
  [38, "Hold project status update meeting (minimum monthly, twice preferred)", "PM", "Governance"],
  [39, "Deploy release candidate to UAT; run and pass smoke test", "DEVOPS", "CI/CD", 20],
  [40, "Validate build pipeline", "DEVOPS", "CI/CD", 21],
  [41, "Run final optimization pass", "ENGINEERING", "Performance"],
  [42, "Run security vulnerability assessment (ZAP, MobSF)", "DEVOPS", "Security", 22],
  [43, "Submit and obtain platform/app-store certification", "PM", "Gates"],
  [44, "Obtain UAT sign-off from client", "PM", "Approvals"],
  [45, "Schedule and execute production deployment; run smoke test in production", "DEVOPS", "CI/CD", 23],
  [46, "Send completion & release report to stakeholders; raise invoice per payment schedule", "PM", "Closure"],
  [47, "Send Project Closure Report; obtain formal completion certificate", "PM", "Closure"],
  [48, "Conduct customer satisfaction survey", "PM", "Closure"],
  [49, "Deliver knowledge transfer package", "PM", "Closure"],
  [50, "Activate support/AMC terms per contract", "PM", "Closure"],
  [51, "Evaluate opportunity to transition from fixed-price to time & material model", "PM", "Closure"],
  // Discovered via production diagnostic — added to the template after the
  // original 51-item seed, not present in the static seed file.
  [52, "Conduct initial risk identification workshop; populate the Risk Register with top risks, severity, and mitigation owners", "PM", "Planning"],
  [53, "Define target performance budget per platform (FPS, draw calls, triangle/poly count, memory)", "QA", "Test Planning"],
];

// DevOps items keep type=DEVOPS — only category (stage) changes.
const DEVOPS_MAP = [
  [1, "Provision cloud infrastructure as code (Terraform/Bicep/ARM)", "Infrastructure"],
  [2, "Set up Dev / Staging / Production environments", "Infrastructure"],
  [3, "Containerize services (Docker) and set up registry", "Infrastructure"],
  [4, "Set up orchestration (Kubernetes / Container Apps / App Service)", "Infrastructure"],
  [5, "Define branching strategy & PR review process", "CI/CD"],
  [6, "Build CI pipeline (build, lint, unit test on PR)", "CI/CD"],
  [7, "Build CD pipeline (auto-deploy to Dev/Staging, gated Prod)", "CI/CD"],
  [8, "Set up automated integration/regression test stage", "CI/CD"],
  [9, "Configure secrets management (Key Vault / Vault / SSM)", "Security"],
  [10, "Run SAST/DAST and dependency vulnerability scanning", "Security"],
  [11, "Set up access control / least-privilege IAM roles", "Security"],
  [12, "Set up monitoring, logging & alerting", "Monitoring"],
  [13, "Configure autoscaling & load balancing", "Monitoring"],
  [14, "Define backup & disaster recovery plan", "Monitoring"],
  [15, "Run load/performance testing pre-launch", "Monitoring"],
  [16, "Define release & rollback runbook", "Monitoring"],
  [17, "Set up incident response process & on-call rotation", "Monitoring"],
  [18, "Production go-live and post-deploy verification", "Monitoring"],
];

// milestoneName carried over from the original PM_CHECKLIST_SEED/
// DEVOPS_CHECKLIST_SEED for the seed-array regeneration below — not used by
// the SQL generation above (MilestonePayment seeding in create-project.ts is
// keyed off whichever ChecklistItem row ends up with a non-null
// milestoneName, regardless of which type/stage it's since moved to).
const PM_MILESTONE_NAMES = {
  3: "Platforms Confirmed",
  5: "Repos Ready",
  6: "DoR Approved",
  7: "PMP Approved",
  13: "Payment Schedule Approved",
  15: "Experience Flow Approved",
  19: "Kickoff Complete",
  24: "Creative Direction Approved",
  43: "Store Approved",
  44: "UAT Signed Off",
  45: "Go-Live",
  47: "Project Closed",
};
const DEVOPS_MILESTONE_NAMES = { 6: "CI Pipeline Green", 16: "Release Process Approved", 18: "Production Go-Live" };

console.log("-- PM reassignment counts by new type:");
const byType = {};
for (const [, , newType] of PM_MAP) byType[newType] = (byType[newType] || 0) + 1;
console.log(byType);

console.log("\n-- SQL: ChecklistTemplateItem + ChecklistItem UPDATE statements --\n");
const sqlLines = [];
for (const [order, , newType, newStage, newOrder] of PM_MAP) {
  const orderSet = newOrder != null ? `, "order" = ${newOrder}` : "";
  sqlLines.push(
    `UPDATE "ChecklistTemplateItem" SET type = '${newType}', stage = '${newStage}'${orderSet} WHERE type = 'PM' AND "order" = ${order};`
  );
  sqlLines.push(
    `UPDATE "ChecklistItem" SET type = '${newType}', stage = '${newStage}'${orderSet} WHERE type = 'PM' AND "order" = ${order} AND "isCustom" = false;`
  );
}
for (const [order, , newStage] of DEVOPS_MAP) {
  sqlLines.push(`UPDATE "ChecklistTemplateItem" SET stage = '${newStage}' WHERE type = 'DEVOPS' AND "order" = ${order};`);
  sqlLines.push(
    `UPDATE "ChecklistItem" SET stage = '${newStage}' WHERE type = 'DEVOPS' AND "order" = ${order} AND "isCustom" = false;`
  );
}
console.log(sqlLines.join("\n"));

import { writeFileSync } from "fs";
writeFileSync(new URL("./checklist-migration.sql", import.meta.url), sqlLines.join("\n") + "\n");
console.log(`\nWrote ${sqlLines.length} statements to checklist-migration.sql`);

// --- Regenerate the static seed arrays (lib/seed-data.ts) so a from-scratch
// environment (scripts/seed-checklist-template.ts run against an empty DB)
// produces the same structure as the live, migrated database — otherwise the
// seed script would still emit the OLD stage names, which wouldn't match the
// new PM_STAGES/DEVOPS_CATEGORIES and would render invisible everywhere.
function esc(s) {
  return s.replace(/"/g, '\\"');
}

const byNewType = { PM: [], ENGINEERING: [], QA: [], DEVOPS: [], CREATIVE_XR: [] };
for (const [order, itemText, newType, newStage] of PM_MAP) {
  byNewType[newType].push({ stage: newStage, itemText, milestoneName: PM_MILESTONE_NAMES[order] ?? null });
}
for (const [order, itemText, newStage] of DEVOPS_MAP) {
  byNewType.DEVOPS.push({ stage: newStage, itemText, milestoneName: DEVOPS_MILESTONE_NAMES[order] ?? null });
}

function renderArray(constName, items) {
  const lines = items.map(
    (it, i) =>
      `  { order: ${i + 1}, stage: "${esc(it.stage)}", itemText: "${esc(it.itemText)}", milestoneName: ${it.milestoneName ? `"${esc(it.milestoneName)}"` : "null"} },`
  );
  return `export const ${constName}: ChecklistSeedItem[] = [\n${lines.join("\n")}\n];\n`;
}

const seedArraysSource = [
  renderArray("PM_CHECKLIST_SEED", byNewType.PM),
  renderArray("ENGINEERING_CHECKLIST_SEED", byNewType.ENGINEERING),
  renderArray("QA_CHECKLIST_SEED", byNewType.QA),
  renderArray("DEVOPS_CHECKLIST_SEED", byNewType.DEVOPS),
  renderArray("CREATIVE_XR_CHECKLIST_SEED", byNewType.CREATIVE_XR),
].join("\n");

writeFileSync(new URL("./checklist-seed-arrays.ts", import.meta.url), seedArraysSource);
console.log(`Wrote regenerated seed arrays to checklist-seed-arrays.ts (${Object.entries(byNewType).map(([k, v]) => `${k}:${v.length}`).join(", ")})`);
