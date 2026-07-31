export type ChecklistSeedItem = {
  order: number;
  stage: string;
  itemText: string;
  milestoneName: string | null;
};

// Transcribed verbatim from PM_Checklist_Tracker.xlsx, sheet "PM Checklist" (rows 5-55).
export const PM_CHECKLIST_SEED: ChecklistSeedItem[] = [
  { order: 1, stage: "Pre-Sales & Initiation", itemText: "Collect RFP, Proposal, and Contract/PO copies", milestoneName: null },
  { order: 2, stage: "Pre-Sales & Initiation", itemText: "Send project initiation email to assigned PM", milestoneName: null },
  { order: 3, stage: "Pre-Sales & Initiation", itemText: "Confirm client-approved platforms and performance expectations (Quest/Vision Pro/WebXR/AR/PCVR)", milestoneName: "Platforms Confirmed" },
  { order: 4, stage: "Pre-Sales & Initiation", itemText: "Create MS Teams channel and SharePoint space for the project", milestoneName: null },
  { order: 5, stage: "Pre-Sales & Initiation", itemText: "Create Git repository for code AND set up asset version control (Git LFS / DAM) for large 3D files", milestoneName: "Repos Ready" },
  { order: 6, stage: "Pre-Sales & Initiation", itemText: "Complete and approve Definition of Ready (DoR): requirement, design, backend/3rd-party API, performance/security requirement, target platform", milestoneName: "DoR Approved" },
  { order: 7, stage: "Planning", itemText: "Draft Project Management Plan (use PMP_Template.docx): rationale, stakeholders/access, charter, methodology, test plan, deployment plan, communications plan, RACI matrix (PM/TL/BA/Lead Eng/Creative Lead)", milestoneName: "PMP Approved" },
  { order: 8, stage: "Planning", itemText: "Define fixed-budget contingency/buffer percentage in the PM Plan", milestoneName: null },
  { order: 9, stage: "Planning", itemText: "Define CR pricing basis (man-day rate used for paid change requests)", milestoneName: null },
  { order: 10, stage: "Planning", itemText: "Define budget/schedule overrun escalation thresholds (e.g., CPI/SPI trigger points requiring leadership review)", milestoneName: null },
  { order: 11, stage: "Planning", itemText: "Development estimation of Epics in story points (1 SP = 1 man-day); notify manager if estimate exceeds sales quote", milestoneName: null },
  { order: 12, stage: "Planning", itemText: "Build WBS Level 1 (Epics, tabular format, sourced from proposal/RFP/contract) and load into PM tool", milestoneName: null },
  { order: 13, stage: "Planning", itemText: "Map each milestone (~1 month cadence) to a payment tranche in the schedule", milestoneName: "Payment Schedule Approved" },
  { order: 14, stage: "Planning", itemText: "Set up WBS ID <-> SRS traceability (Product Backlog)", milestoneName: null },
  { order: 15, stage: "Planning", itemText: "Approve experience flow & interaction map; agree targeted platform and performance constraints", milestoneName: "Experience Flow Approved" },
  { order: 16, stage: "Planning", itemText: "Define 3D assets plan; plan and validate environment graybox", milestoneName: null },
  { order: 17, stage: "Planning", itemText: "Prepare Figma / 3D UX mockups", milestoneName: null },
  { order: 18, stage: "Planning", itemText: "Define Definition of Done (DoD) checklist, including XR-specific criteria (device tested, performance budget met, asset validated)", milestoneName: null },
  { order: 19, stage: "Kickoff", itemText: "Hold project kickoff meeting with client present; celebrate with team/client/sales", milestoneName: "Kickoff Complete" },
  { order: 20, stage: "Kickoff", itemText: "Share SRS with estimation with client (request sign-off/acknowledgement; do not block on it)", milestoneName: null },
  { order: 21, stage: "Kickoff", itemText: "Review and confirm payment terms and schedule", milestoneName: null },
  { order: 22, stage: "Kickoff", itemText: "Upload final pre-development documents to the project repository", milestoneName: null },
  { order: 23, stage: "Creative Huddle", itemText: "Run Creative Huddle workshop with client: walk through concepts, validate user journey, agree 3D asset direction", milestoneName: null },
  { order: 24, stage: "Creative Huddle", itemText: "Finalize Experience Flow / storyboard", milestoneName: "Creative Direction Approved" },
  { order: 25, stage: "Creative Huddle", itemText: "Approve Visual Style Reference (mood board, sample assets)", milestoneName: null },
  { order: 26, stage: "Creative Huddle", itemText: "Confirm Feature Definition Sheet and scope boundaries with client", milestoneName: null },
  { order: 27, stage: "Development", itemText: "Hold backlog refinement / release planning meeting; add signed CRs to WBS", milestoneName: null },
  { order: 28, stage: "Development", itemText: "Hold sprint planning meeting; send SRS Sprint PDF to client", milestoneName: null },
  { order: 29, stage: "Development", itemText: "Log daily standups and time entries in PM tool", milestoneName: null },
  { order: 30, stage: "Development", itemText: "Run automated AI code review (Git Action) on every PR; senior dev manual review before merge", milestoneName: null },
  { order: 31, stage: "Development", itemText: "Run device-level testing each sprint (FPS, draw calls, shader complexity)", milestoneName: null },
  { order: 32, stage: "Development", itemText: "Run comfort & accessibility QA each sprint (motion sickness, colorblind mode, seated/standing, subtitles)", milestoneName: null },
  { order: 33, stage: "Development", itemText: "Validate asset imports (scale, naming, texture size); test API integration on staging; implement error handling/fallback", milestoneName: null },
  { order: 34, stage: "Development", itemText: "Execute test cases; log and retest defects", milestoneName: null },
  { order: 35, stage: "Development", itemText: "Record and share sprint review demo with client and stakeholders", milestoneName: null },
  { order: 36, stage: "Development", itemText: "Update CPI/SPI report weekly; escalate if beyond defined threshold", milestoneName: null },
  { order: 37, stage: "Development", itemText: "Hold sprint retrospective (minimum monthly)", milestoneName: null },
  { order: 38, stage: "Development", itemText: "Hold project status update meeting (minimum monthly, twice preferred)", milestoneName: null },
  { order: 39, stage: "Release", itemText: "Deploy release candidate to UAT; run and pass smoke test", milestoneName: null },
  { order: 40, stage: "Release", itemText: "Validate build pipeline (Unity to Android/iOS/PCVR/WebGL; AI model deployment infra; CDN for 3D assets)", milestoneName: null },
  { order: 41, stage: "Release", itemText: "Run final optimization pass (XR scenes, AI inference latency, backend API load)", milestoneName: null },
  { order: 42, stage: "Release", itemText: "Run security vulnerability assessment (ZAP, MobSF)", milestoneName: null },
  { order: 43, stage: "Release", itemText: "Submit and obtain platform/app-store certification (Meta Quest Store, Apple Vision Pro, SteamVR)", milestoneName: "Store Approved" },
  { order: 44, stage: "Release", itemText: "Obtain UAT sign-off from client", milestoneName: "UAT Signed Off" },
  { order: 45, stage: "Release", itemText: "Schedule and execute production deployment; run smoke test in production", milestoneName: "Go-Live" },
  { order: 46, stage: "Release", itemText: "Send completion & release report to stakeholders; raise invoice per payment schedule", milestoneName: null },
  { order: 47, stage: "Closing & Maintenance", itemText: "Send Project Closure Report; obtain formal completion certificate", milestoneName: "Project Closed" },
  { order: 48, stage: "Closing & Maintenance", itemText: "Conduct customer satisfaction survey", milestoneName: null },
  { order: 49, stage: "Closing & Maintenance", itemText: "Deliver knowledge transfer package: domain video/doc plus technical documentation/video", milestoneName: null },
  { order: 50, stage: "Closing & Maintenance", itemText: "Activate support/AMC terms per contract (after full payment)", milestoneName: null },
  { order: 51, stage: "Closing & Maintenance", itemText: "Evaluate opportunity to transition from fixed-price to time & material model", milestoneName: null },
];

// Transcribed verbatim from PM_Checklist_Tracker.xlsx, sheet "DevOps Checklist" (rows 5-22).
export const DEVOPS_CHECKLIST_SEED: ChecklistSeedItem[] = [
  { order: 1, stage: "Infrastructure", itemText: "Provision cloud infrastructure as code (Terraform/Bicep/ARM)", milestoneName: null },
  { order: 2, stage: "Infrastructure", itemText: "Set up Dev / Staging / Production environments", milestoneName: null },
  { order: 3, stage: "Infrastructure", itemText: "Containerize services (Docker) and set up registry", milestoneName: null },
  { order: 4, stage: "Infrastructure", itemText: "Set up orchestration (Kubernetes / Container Apps / App Service)", milestoneName: null },
  { order: 5, stage: "CI/CD", itemText: "Define branching strategy & PR review process", milestoneName: null },
  { order: 6, stage: "CI/CD", itemText: "Build CI pipeline (build, lint, unit test on PR)", milestoneName: "CI Pipeline Green" },
  { order: 7, stage: "CI/CD", itemText: "Build CD pipeline (auto-deploy to Dev/Staging, gated Prod)", milestoneName: null },
  { order: 8, stage: "CI/CD", itemText: "Set up automated integration/regression test stage", milestoneName: null },
  { order: 9, stage: "Security", itemText: "Configure secrets management (Key Vault / Vault / SSM)", milestoneName: null },
  { order: 10, stage: "Security", itemText: "Run SAST/DAST and dependency vulnerability scanning", milestoneName: null },
  { order: 11, stage: "Security", itemText: "Set up access control / least-privilege IAM roles", milestoneName: null },
  { order: 12, stage: "Reliability", itemText: "Set up monitoring, logging & alerting (App Insights/Datadog/Grafana)", milestoneName: null },
  { order: 13, stage: "Reliability", itemText: "Configure autoscaling & load balancing", milestoneName: null },
  { order: 14, stage: "Reliability", itemText: "Define backup & disaster recovery plan", milestoneName: null },
  { order: 15, stage: "Reliability", itemText: "Run load/performance testing pre-launch", milestoneName: null },
  { order: 16, stage: "Release & Ops", itemText: "Define release & rollback runbook", milestoneName: "Release Process Approved" },
  { order: 17, stage: "Release & Ops", itemText: "Set up incident response process & on-call rotation", milestoneName: null },
  { order: 18, stage: "Release & Ops", itemText: "Production go-live and post-deploy verification", milestoneName: "Production Go-Live" },
];

export const PM_STAGES = [
  // Only ever populated on a project won from a Presales opportunity — see
  // winPresalesProject in app/presales/actions.ts. Empty on every other
  // project; ChecklistTable and currentStage() both already skip stages
  // with 0 rows, so this is inert everywhere else.
  "Presales",
  "Pre-Sales & Initiation",
  "Planning",
  "Kickoff",
  "Creative Huddle",
  "Development",
  "Release",
  "Closing & Maintenance",
] as const;

export const DEVOPS_CATEGORIES = [
  "Infrastructure",
  "CI/CD",
  "Security",
  "Reliability",
  "Release & Ops",
] as const;

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
