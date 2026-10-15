export type ChecklistSeedItem = {
  order: number;
  stage: string;
  itemText: string;
  milestoneName: string | null;
  // Ongoing cadence (weekly report, per-sprint testing, ...) rather than a
  // one-off step — see isTrackedChecklistItem. Optional: false when omitted.
  isRecurring?: boolean;
};

// The checklist template as of the 20261015120000_checklist_template_review
// migration, which writes exactly these rows into ChecklistTemplateItem (and
// reconciles existing projects' copies) — kept here so a from-scratch
// environment (scripts/seed-checklist-template.ts against an empty DB)
// produces the same template as the live, migrated database. Item wording
// is the live template's (edited over time on Admin → Checklist Template),
// not the original PM_Checklist_Tracker.xlsx transcription.
//
// Each checklist owns one kind of check, so nothing is ticked twice:
// PM = governance, planning, approvals, money and closure; Dev = the
// development gate (readiness → execution → quality gate → completion);
// QA & Testing (key DELIVERY_QA) = test planning and test passes; DevOps =
// environments, pipelines, security, operations; Creative & XR = creative
// direction, 3D, UX, assets and on-headset validation.

const seed = (stage: string, itemText: string, opts: { checkpoint?: string; recurring?: boolean } = {}) => ({
  stage,
  itemText,
  milestoneName: opts.checkpoint ?? null,
  ...(opts.recurring ? { isRecurring: true } : {}),
});

function numbered(items: Omit<ChecklistSeedItem, "order">[]): ChecklistSeedItem[] {
  return items.map((item, i) => ({ order: i + 1, ...item }));
}

export const PM_CHECKLIST_SEED: ChecklistSeedItem[] = numbered([
  seed("Governance", "Collect RFP, Proposal, and Contract/PO copies"),
  seed("Governance", "Send project initiation email to assigned PM"),
  seed("Governance", "Confirm client-approved platforms and performance expectations", { checkpoint: "Platforms Confirmed" }),
  seed("Governance", "Confirm data privacy and compliance requirements with the client (GDPR/HIPAA, data residency, consent)"),
  seed("Governance", "Create MS Teams channel and SharePoint space for the project"),
  seed("Governance", "Onboard the team: tool and environment access, NDAs signed"),
  seed("Governance", "Record and share sprint review demo with client and stakeholders", { recurring: true }),
  seed("Governance", "Update CPI/SPI report weekly; escalate if beyond defined threshold", { recurring: true }),
  seed("Governance", "Hold sprint retrospective (minimum monthly)", { recurring: true }),
  seed("Governance", "Hold project status update meeting (minimum monthly, twice preferred)", { recurring: true }),
  seed("Planning", "Complete and approve Definition of Ready (DoR): requirement, design, backend/3rd-party API, performance/security requirement, target platform", { checkpoint: "DoR Approved" }),
  seed("Planning", "Draft Project Management Plan", { checkpoint: "PMP Approved" }),
  seed("Planning", "Conduct initial risk identification workshop; populate the Risk Register with top risks, severity, and mitigation owners"),
  seed("Planning", "Define fixed-budget contingency/buffer percentage in the PM Plan"),
  seed("Planning", "Define CR pricing basis (man-day rate used for paid change requests)"),
  seed("Planning", "Define budget/schedule overrun escalation thresholds (e.g., CPI/SPI trigger points requiring leadership review)"),
  seed("Planning", "Development estimation of Epics in story points, notify manager if estimate exceeds sales quote"),
  seed("Planning", "Build WBS Level 1 (Epics, tabular format, sourced from proposal/RFP/contract) and load into PM tool"),
  seed("Planning", "Set up WBS ID <-> SRS traceability (Product Backlog)"),
  seed("Planning", "Upload final pre-development documents to the project repository"),
  seed("Planning", "Hold project kickoff meeting with client present; celebrate with team/client/sales", { checkpoint: "Kickoff Complete" }),
  seed("Planning", "Hold backlog refinement / release planning meeting; add signed CRs to WBS", { recurring: true }),
  seed("Planning", "Hold sprint planning meeting; send SRS Sprint PDF to client", { recurring: true }),
  seed("Approvals", "Share SRS with the client (request sign-off/acknowledgement; do not block on it)."),
  seed("Approvals", "Submit and obtain platform/app-store certification (Meta Quest Store, Apple Vision Pro, SteamVR)", { checkpoint: "Store Approved" }),
  seed("Approvals", "Obtain UAT sign-off from client", { checkpoint: "UAT Signed Off" }),
  seed("Baselines", "Confirm Feature Definition Sheet and scope boundaries with client"),
  seed("Baselines", "Map each milestone (~1 month cadence) to a payment tranche and confirm the payment terms with the client", { checkpoint: "Payment Schedule Approved" }),
  seed("Closure", "Send completion & release report to stakeholders; raise invoice per payment schedule"),
  seed("Closure", "Send Project Closure Report; obtain formal completion certificate", { checkpoint: "Project Closed" }),
  seed("Closure", "Conduct customer satisfaction survey"),
  seed("Closure", "Deliver knowledge transfer package: domain video/doc plus technical documentation/video"),
  seed("Closure", "Hand over credentials, accounts and infrastructure ownership to the client"),
  seed("Closure", "Hold a lessons-learned session; record what to repeat and what to change"),
  seed("Closure", "Revoke client and team access; archive the repos, PM tool and SharePoint space"),
  seed("Closure", "Activate support/AMC terms per contract (after full payment)"),
  seed("Closure", "Evaluate opportunity to transition from fixed-price to time & material model"),
]);

// QA & Testing (key DELIVERY_QA — the key, route and module name predate the
// rename and stay as they are). Development-practice items that used to sit
// in its Development stage moved to the Development Checklist.
export const DELIVERY_QA_CHECKLIST_SEED: ChecklistSeedItem[] = numbered([
  seed("Test Planning", "Define Definition of Done (DoD) checklist, including XR-specific criteria (device tested, performance budget met, asset validated)"),
  seed("Test Planning", "Define target performance budget per platform (FPS, draw calls, triangle/poly count, memory)—referenced by later Definition of Done and per-sprint device testing"),
  seed("Test Planning", "Write the test plan and test cases from the SRS acceptance criteria"),
  seed("Test Planning", "Set up the defect tracker with severity/priority definitions"),
  seed("Functional Testing", "Execute test cases; log and retest defects", { recurring: true }),
  seed("Functional Testing", "Complete a functional test pass on the release candidate (all critical/high cases passed)"),
  seed("Device Testing", "Run device-level testing each sprint (FPS, draw calls, shader complexity)", { recurring: true }),
  seed("Device Testing", "Run comfort & accessibility QA each sprint (motion sickness, colorblind mode, seated/standing, subtitles)", { recurring: true }),
  seed("Device Testing", "Complete a device test pass on every target headset/platform within the performance budget"),
  seed("Regression", "Run full regression on the release candidate; no open critical/high defects"),
  seed("UAT", "Prepare the UAT plan, scripts and build for the client"),
  seed("UAT", "Triage UAT feedback; fix and retest UAT defects before sign-off"),
]);

export const DEVOPS_CHECKLIST_SEED: ChecklistSeedItem[] = numbered([
  seed("Infrastructure", "Create a Git repository AND set up asset version control for large files.", { checkpoint: "Repos Ready" }),
  seed("Infrastructure", "Provision cloud infrastructure as code (Terraform/Bicep/ARM)"),
  seed("Infrastructure", "Set up Dev / Staging / Production environments"),
  seed("Infrastructure", "Containerize services (Docker) and set up registry"),
  seed("Infrastructure", "Set up orchestration (Kubernetes / Container Apps / App Service)"),
  seed("Infrastructure", "Register domains and set up SSL certificates with renewal reminders"),
  seed("CI/CD", "Define branching strategy & PR review process"),
  seed("CI/CD", "Build CI pipeline (build, lint, unit test on PR)", { checkpoint: "CI Pipeline Green" }),
  seed("CI/CD", "Validate build pipeline (Unity to Android/iOS/PCVR/WebGL; AI model deployment infra; CDN for 3D assets)."),
  seed("CI/CD", "Build CD pipeline (auto-deploy to Dev/Staging, gated Prod)"),
  seed("CI/CD", "Set up automated integration/regression test stage"),
  seed("CI/CD", "Deploy release candidate to UAT; run and pass smoke test"),
  seed("CI/CD", "Schedule and execute production deployment; run smoke test and post-deploy verification in production", { checkpoint: "Go-Live" }),
  seed("Security", "Configure secrets management (Key Vault / Vault / SSM)"),
  seed("Security", "Store app-signing keys and store/console credentials in the team vault"),
  seed("Security", "Set up access control / least-privilege IAM roles"),
  seed("Security", "Run SAST/DAST, dependency and mobile security scans (e.g. ZAP, MobSF)"),
  seed("Monitoring", "Set up monitoring, logging & alerting (App Insights/Datadog/Grafana)"),
  seed("Monitoring", "Set up cloud cost monitoring and budget alerts"),
  seed("Monitoring", "Configure autoscaling & load balancing"),
  seed("Monitoring", "Define backup & disaster recovery plan"),
  seed("Monitoring", "Run load/performance testing pre-launch"),
  seed("Monitoring", "Define release & rollback runbook", { checkpoint: "Release Process Approved" }),
  seed("Monitoring", "Set up incident response process & on-call rotation"),
]);

export const CREATIVE_XR_CHECKLIST_SEED: ChecklistSeedItem[] = numbered([
  seed("Storyboard", "Run the Creative Huddle workshop with the client: walk through concepts, validate the user journey, and agree on 3D asset direction."),
  seed("Storyboard", "Finalize Experience Flow / storyboard", { checkpoint: "Creative Direction Approved" }),
  seed("3D", "Review 3D models, rigs and animations against the style reference"),
  seed("3D", "Get client approval of the key 3D assets"),
  seed("UX", "Prepare Figma / 3D UX mockups"),
  seed("UX", "Approve experience flow & interaction map.", { checkpoint: "Experience Flow Approved" }),
  seed("Assets", "Approve Visual Style Reference"),
  seed("Assets", "Define assets plan; plan and validate environment graybox(UI/3D Assets)"),
  seed("XR Validation", "Validate interactions and comfort on the target headsets with the creative lead"),
  seed("XR Validation", "Check the build against the store content and design guidelines (Meta, Apple, Steam)"),
]);

export const PM_STAGES = [
  // Only ever populated on a project won from a Presales opportunity — see
  // winPresalesProject in app/presales/actions.ts. Empty on every other
  // project; ChecklistTable and currentStage() both already skip stages
  // with 0 rows, so this is inert everywhere else.
  "Presales",
  "Governance",
  "Planning",
  "Approvals",
  "Baselines",
  // A "Gates" stage used to sit here holding just two unrelated items
  // (kickoff -> now Planning, store certification -> now Approvals). Removed
  // so "gate" means only PM Plan's G0-G6 stage-gate framework — see the
  // 20261014150000 migration and docs/FIX_PLAN.md Phase 4.
  "Closure",
] as const;

// Reassigned from a wider 5-category list (Infrastructure/CI-CD/Security/
// Reliability/Release & Ops) — Reliability and Release & Ops content folds
// into Monitoring as part of the same migration that split PM_STAGES above.
export const DEVOPS_CATEGORIES = ["Infrastructure", "CI/CD", "Security", "Monitoring"] as const;

// QA & Testing only. Architecture / Development / Code Review / Performance /
// Technical QA were the old Engineering half — development checks now live
// on the Development Checklist (the 20261015120000 migration moved any
// project items in those stages there).
export const DELIVERY_QA_STAGES = ["Test Planning", "Functional Testing", "Device Testing", "Regression", "UAT"] as const;

export const CREATIVE_XR_STAGES = ["Storyboard", "3D", "UX", "Assets", "XR Validation"] as const;

// Development Checklist — a technical delivery quality/governance gate,
// distinct from PM Checklist's governance items and from WBS/Sprint Tasks
// (this is never for individual dev tasks like "Implement Login API"; those
// belong on the Tasks/Sprint tab).
export const DEV_STAGES = ["Development Readiness", "Development Execution", "Quality Gate", "Development Completion"] as const;

// Deliberately no checkpoint (milestoneName) on any item — Development
// Checklist must never stand in for a client milestone; a PM adds one on
// Milestones & Payments explicitly if this gate genuinely marks one.
// Readiness items the PM's Definition of Ready already covers (requirements,
// acceptance criteria, scope), environment/repo items DevOps owns, and items
// other tabs track (dependencies, task assignment, milestone sign-off) were
// removed so nothing is ticked in two places.
export const DEV_CHECKLIST_SEED: ChecklistSeedItem[] = numbered([
  seed("Development Readiness", "Technical approach approved"),
  seed("Development Readiness", "Architecture available"),
  seed("Development Readiness", "Required APIs/services available"),
  seed("Development Readiness", "Required assets available"),
  seed("Development Execution", "Development completed against requirements"),
  seed("Development Execution", "Run automated AI code review (Git Action) on every PR; senior dev manual review before merge"),
  seed("Development Execution", "Unit testing completed"),
  seed("Development Execution", "Validate asset imports (scale, naming, texture size); test API integration on staging; implement error handling/fallback"),
  seed("Development Execution", "Integration completed"),
  seed("Development Execution", "Security considerations reviewed"),
  seed("Development Execution", "Technical debt identified"),
  seed("Development Execution", "Sprint scope confirmed", { recurring: true }),
  seed("Quality Gate", "Run final optimization pass (XR scenes, AI inference latency, backend API load)"),
  seed("Quality Gate", "Build generated successfully"),
  seed("Quality Gate", "Automated tests passed"),
  seed("Quality Gate", "Smoke test completed"),
  seed("Quality Gate", "Critical defects resolved"),
  seed("Quality Gate", "Regression completed"),
  seed("Quality Gate", "Performance requirements validated"),
  seed("Quality Gate", "Supported platform/device testing completed"),
  seed("Quality Gate", "Release candidate validated"),
  seed("Development Completion", "Feature acceptance completed"),
  seed("Development Completion", "Known issues recorded on the release (Delivery → Releases)"),
  seed("Development Completion", "Technical documentation completed"),
  seed("Development Completion", "Technical handover completed"),
  seed("Development Completion", "Sprint acceptance completed", { recurring: true }),
]);

// Default rows from PMP_Template.docx, used to pre-populate a new project's PM Plan.
export const DEFAULT_STAKEHOLDER_ROWS = [
  { stakeholder: "Sponsor", role: "Approves budget/scope", responsibility: "Final decision authority", accessRequired: "Status reports" },
  { stakeholder: "Client / Product Owner", role: "Defines requirements", responsibility: "Prioritizes backlog, sign-off", accessRequired: "Project tools, environments as needed" },
  { stakeholder: "Project Manager", role: "Delivery ownership", responsibility: "Planning, coordination, risk mgmt", accessRequired: "All project systems" },
  { stakeholder: "Development Team", role: "Builds the solution", responsibility: "Implementation", accessRequired: "Repo, dev/staging environments" },
  { stakeholder: "QA Team", role: "Ensures quality", responsibility: "Testing, defect tracking", accessRequired: "Staging, test tools" },
  { stakeholder: "Operations / DevOps", role: "Deployment & infra", responsibility: "Release management", accessRequired: "Production environment, CI/CD" },
];

export const DEFAULT_COMMS_ROWS = [
  { audience: "Sponsor", frequency: "Bi-weekly", channel: "Email / report", content: "High-level status, risks, budget" },
  { audience: "Client", frequency: "Weekly", channel: "Call / email", content: "Progress, demos, blockers" },
  { audience: "Internal Team", frequency: "Daily", channel: "Standup", content: "Task status, impediments" },
  { audience: "All Stakeholders", frequency: "At milestones", channel: "Status report", content: "Milestone completion, next steps" },
];

export const DEFAULT_RACI_ROWS = [
  { activity: "Project Charter & Kickoff", pm: "A/R", tl: "C", ba: "C", leadEng: "I", creativeLead: "I" },
  { activity: "Requirements Gathering", pm: "C", tl: "C", ba: "A/R", leadEng: "I", creativeLead: "C" },
  { activity: "Scope Definition", pm: "A", tl: "C", ba: "R", leadEng: "C", creativeLead: "C" },
  { activity: "Creative Concept & Design Direction", pm: "I", tl: "I", ba: "C", leadEng: "I", creativeLead: "A/R" },
  { activity: "Technical Architecture", pm: "I", tl: "A/R", ba: "C", leadEng: "R", creativeLead: "I" },
  { activity: "UI/UX Design", pm: "I", tl: "I", ba: "C", leadEng: "I", creativeLead: "A/R" },
  { activity: "Sprint Planning", pm: "A/R", tl: "C", ba: "C", leadEng: "C", creativeLead: "C" },
  { activity: "Development", pm: "I", tl: "A", ba: "I", leadEng: "R", creativeLead: "I" },
  { activity: "Code Review", pm: "I", tl: "A/R", ba: "I", leadEng: "R", creativeLead: "I" },
  { activity: "QA / Testing", pm: "R", tl: "C", ba: "C", leadEng: "C", creativeLead: "I" },
  { activity: "UAT Coordination", pm: "A/R", tl: "I", ba: "C", leadEng: "I", creativeLead: "I" },
  { activity: "Deployment / Release", pm: "A", tl: "R", ba: "I", leadEng: "R", creativeLead: "I" },
  { activity: "Client Communication", pm: "A/R", tl: "C", ba: "C", leadEng: "I", creativeLead: "C" },
  { activity: "Risk Management", pm: "A/R", tl: "C", ba: "C", leadEng: "C", creativeLead: "I" },
  { activity: "Change Request Handling", pm: "A/R", tl: "C", ba: "R", leadEng: "C", creativeLead: "C" },
  { activity: "Documentation", pm: "A", tl: "C", ba: "R", leadEng: "C", creativeLead: "I" },
  { activity: "Retrospective / Project Closure", pm: "A/R", tl: "C", ba: "C", leadEng: "C", creativeLead: "C" },
];
