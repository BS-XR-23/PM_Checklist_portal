-- Checklist template review (docs/USER_GUIDE.md §7): each check lives in
-- exactly one checklist, per-sprint activities become Ongoing cadence items,
-- empty stages get real content, and "Delivery & QA" becomes "QA & Testing"
-- (key DELIVERY_QA unchanged). Data only — no schema change.
--
-- Existing projects are reconciled conservatively:
--   * nothing a PM has touched is deleted (status, a date, owner, link,
--     notes or any link to a milestone/task/sprint/payment counts as
--     touched); retired items that were touched stay as they are;
--   * new items are added only to ACTIVE projects that already use that
--     checklist; archived projects keep their numbers;
--   * moves, re-wordings and cadence flags apply to every project.

-- 1. Development-practice items leave QA & Testing for the Development
--    Checklist (its Architecture/Development/Code Review/Performance/
--    Technical QA stages are retired). Appended after each project's last
--    Dev item, so (projectId, type, order) stays unique.
WITH moved AS (
  SELECT ci."id", ci."projectId",
         ROW_NUMBER() OVER (PARTITION BY ci."projectId" ORDER BY ci."order") AS rn
  FROM "ChecklistItem" ci
  WHERE ci."type" = 'DELIVERY_QA'
    AND ci."stage" IN ('Architecture', 'Development', 'Code Review', 'Performance', 'Technical QA')
), base AS (
  SELECT "projectId", MAX("order") AS mx FROM "ChecklistItem" WHERE "type" = 'DEV' GROUP BY "projectId"
)
UPDATE "ChecklistItem" ci
SET "type" = 'DEV',
    "stage" = CASE
      WHEN ci."itemText" LIKE 'Run final optimization pass%' OR ci."stage" IN ('Performance', 'Technical QA') THEN 'Quality Gate'
      WHEN ci."stage" = 'Architecture' THEN 'Development Readiness'
      ELSE 'Development Execution'
    END,
    "order" = COALESCE(b.mx, 0) + m.rn
FROM moved m
LEFT JOIN base b ON b."projectId" = m."projectId"
WHERE ci."id" = m."id";

-- 2. Per-sprint device checks get their own stage.
UPDATE "ChecklistItem" SET "stage" = 'Device Testing'
WHERE "type" = 'DELIVERY_QA' AND "stage" = 'Functional Testing'
  AND ("itemText" LIKE 'Run device-level testing%' OR "itemText" LIKE 'Run comfort & accessibility%');

-- 3. Per-sprint activities are Ongoing cadence, not one-off steps.
UPDATE "ChecklistItem" SET "isRecurring" = true
WHERE ("type" = 'PM' AND ("itemText" LIKE 'Hold backlog refinement%' OR "itemText" LIKE 'Hold sprint planning meeting%'))
   OR ("type" = 'DEV' AND "itemText" IN ('Sprint scope confirmed', 'Sprint acceptance completed'))
   OR ("type" = 'DELIVERY_QA' AND ("itemText" LIKE 'Execute test cases%' OR "itemText" LIKE 'Run device-level testing%' OR "itemText" LIKE 'Run comfort & accessibility%'));

-- 4. Merged wording (the item that absorbs a retired duplicate).
UPDATE "ChecklistItem" SET "itemText" = 'Map each milestone (~1 month cadence) to a payment tranche and confirm the payment terms with the client'
WHERE "type" = 'PM' AND "itemText" LIKE 'Map each milestone%';
UPDATE "ChecklistItem" SET "itemText" = 'Schedule and execute production deployment; run smoke test and post-deploy verification in production'
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Schedule and execute production deployment%';
UPDATE "ChecklistItem" SET "itemText" = 'Run SAST/DAST, dependency and mobile security scans (e.g. ZAP, MobSF)'
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Run SAST/DAST%';
UPDATE "ChecklistItem" SET "itemText" = 'Known issues recorded on the release (Delivery → Releases)'
WHERE "type" = 'DEV' AND "itemText" = 'Known issues documented';

-- 5. Retired duplicates: removed only where nobody has touched them.
DELETE FROM "ChecklistItem" ci
WHERE ci."isCustom" = false
  AND ci."status" = 'NOT_STARTED'
  AND ci."plannedDate" IS NULL AND ci."actualDate" IS NULL
  AND ci."owner" IS NULL AND ci."ownerPersonId" IS NULL
  AND COALESCE(ci."notes", '') = '' AND COALESCE(ci."link", '') = ''
  AND ci."milestoneId" IS NULL AND ci."wbsTaskId" IS NULL AND ci."sprintId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "MilestonePayment" mp WHERE mp."checklistItemId" = ci."id")
  AND (
    (ci."type" = 'DEV' AND ci."itemText" IN (
      'Requirements/SRS available', 'Acceptance criteria defined', 'Scope confirmed', 'Dependencies identified',
      'Development environment ready', 'Repository/branch ready', 'Tasks assigned', 'Code review completed',
      'API/error handling implemented', 'Technical documentation updated',
      'Milestone acceptance criteria satisfied', 'Development milestone approved'))
    OR (ci."type" = 'PM' AND ci."itemText" = 'Review and confirm payment terms and schedule')
    OR (ci."type" = 'DEVOPS' AND ci."itemText" IN ('Production go-live and post-deploy verification', 'Run security vulnerability assessment (ZAP, MobSF)'))
  );

-- 6. New items, appended to ACTIVE projects that already use the checklist
--    (skipped where the project already has an item with the same wording).
WITH new_items ("type", "stage", "itemText", rank) AS (
  VALUES
    ('PM', 'Governance', 'Confirm data privacy and compliance requirements with the client (GDPR/HIPAA, data residency, consent)', 1),
    ('PM', 'Governance', 'Onboard the team: tool and environment access, NDAs signed', 2),
    ('PM', 'Closure', 'Hand over credentials, accounts and infrastructure ownership to the client', 3),
    ('PM', 'Closure', 'Hold a lessons-learned session; record what to repeat and what to change', 4),
    ('PM', 'Closure', 'Revoke client and team access; archive the repos, PM tool and SharePoint space', 5),
    ('DELIVERY_QA', 'Test Planning', 'Write the test plan and test cases from the SRS acceptance criteria', 1),
    ('DELIVERY_QA', 'Test Planning', 'Set up the defect tracker with severity/priority definitions', 2),
    ('DELIVERY_QA', 'Functional Testing', 'Complete a functional test pass on the release candidate (all critical/high cases passed)', 3),
    ('DELIVERY_QA', 'Device Testing', 'Complete a device test pass on every target headset/platform within the performance budget', 4),
    ('DELIVERY_QA', 'Regression', 'Run full regression on the release candidate; no open critical/high defects', 5),
    ('DELIVERY_QA', 'UAT', 'Prepare the UAT plan, scripts and build for the client', 6),
    ('DELIVERY_QA', 'UAT', 'Triage UAT feedback; fix and retest UAT defects before sign-off', 7),
    ('DEVOPS', 'Infrastructure', 'Register domains and set up SSL certificates with renewal reminders', 1),
    ('DEVOPS', 'Security', 'Store app-signing keys and store/console credentials in the team vault', 2),
    ('DEVOPS', 'Monitoring', 'Set up cloud cost monitoring and budget alerts', 3),
    ('CREATIVE_XR', '3D', 'Review 3D models, rigs and animations against the style reference', 1),
    ('CREATIVE_XR', '3D', 'Get client approval of the key 3D assets', 2),
    ('CREATIVE_XR', 'XR Validation', 'Validate interactions and comfort on the target headsets with the creative lead', 3),
    ('CREATIVE_XR', 'XR Validation', 'Check the build against the store content and design guidelines (Meta, Apple, Steam)', 4)
), eligible AS (
  SELECT DISTINCT ci."projectId", ci."type"
  FROM "ChecklistItem" ci
  JOIN "Project" p ON p."id" = ci."projectId"
  WHERE p."status" = 'ACTIVE'
), to_add AS (
  SELECT e."projectId", n."type", n."stage", n."itemText",
         ROW_NUMBER() OVER (PARTITION BY e."projectId", n."type" ORDER BY n.rank) AS rn
  FROM eligible e
  JOIN new_items n ON n."type" = e."type"
  WHERE NOT EXISTS (
    SELECT 1 FROM "ChecklistItem" x
    WHERE x."projectId" = e."projectId" AND x."type" = n."type" AND x."itemText" = n."itemText"
  )
), base AS (
  SELECT "projectId", "type", MAX("order") AS mx FROM "ChecklistItem" GROUP BY "projectId", "type"
)
INSERT INTO "ChecklistItem" ("id", "projectId", "type", "order", "stage", "itemText", "status", "isCustom", "isRecurring")
SELECT 'cki-2026-10-15-' || md5(a."projectId" || a."type" || a."itemText"), a."projectId", a."type", b.mx + a.rn, a."stage", a."itemText", 'NOT_STARTED', false, false
FROM to_add a
JOIN base b ON b."projectId" = a."projectId" AND b."type" = a."type";

-- 7. The template itself (what new projects copy): replaced wholesale with
--    the reviewed list — identical to lib/seed-data.ts.
DELETE FROM "ChecklistTemplateItem" WHERE "type" IN ('PM', 'DELIVERY_QA', 'DEVOPS', 'CREATIVE_XR', 'DEV');
INSERT INTO "ChecklistTemplateItem" ("id", "type", "order", "stage", "itemText", "milestoneName", "isRecurring") VALUES
  ('tpl-2026-10-15-pm-01', 'PM', 1, 'Governance', 'Collect RFP, Proposal, and Contract/PO copies', NULL, false),
  ('tpl-2026-10-15-pm-02', 'PM', 2, 'Governance', 'Send project initiation email to assigned PM', NULL, false),
  ('tpl-2026-10-15-pm-03', 'PM', 3, 'Governance', 'Confirm client-approved platforms and performance expectations', 'Platforms Confirmed', false),
  ('tpl-2026-10-15-pm-04', 'PM', 4, 'Governance', 'Confirm data privacy and compliance requirements with the client (GDPR/HIPAA, data residency, consent)', NULL, false),
  ('tpl-2026-10-15-pm-05', 'PM', 5, 'Governance', 'Create MS Teams channel and SharePoint space for the project', NULL, false),
  ('tpl-2026-10-15-pm-06', 'PM', 6, 'Governance', 'Onboard the team: tool and environment access, NDAs signed', NULL, false),
  ('tpl-2026-10-15-pm-07', 'PM', 7, 'Governance', 'Record and share sprint review demo with client and stakeholders', NULL, true),
  ('tpl-2026-10-15-pm-08', 'PM', 8, 'Governance', 'Update CPI/SPI report weekly; escalate if beyond defined threshold', NULL, true),
  ('tpl-2026-10-15-pm-09', 'PM', 9, 'Governance', 'Hold sprint retrospective (minimum monthly)', NULL, true),
  ('tpl-2026-10-15-pm-10', 'PM', 10, 'Governance', 'Hold project status update meeting (minimum monthly, twice preferred)', NULL, true),
  ('tpl-2026-10-15-pm-11', 'PM', 11, 'Planning', 'Complete and approve Definition of Ready (DoR): requirement, design, backend/3rd-party API, performance/security requirement, target platform', 'DoR Approved', false),
  ('tpl-2026-10-15-pm-12', 'PM', 12, 'Planning', 'Draft Project Management Plan', 'PMP Approved', false),
  ('tpl-2026-10-15-pm-13', 'PM', 13, 'Planning', 'Conduct initial risk identification workshop; populate the Risk Register with top risks, severity, and mitigation owners', NULL, false),
  ('tpl-2026-10-15-pm-14', 'PM', 14, 'Planning', 'Define fixed-budget contingency/buffer percentage in the PM Plan', NULL, false),
  ('tpl-2026-10-15-pm-15', 'PM', 15, 'Planning', 'Define CR pricing basis (man-day rate used for paid change requests)', NULL, false),
  ('tpl-2026-10-15-pm-16', 'PM', 16, 'Planning', 'Define budget/schedule overrun escalation thresholds (e.g., CPI/SPI trigger points requiring leadership review)', NULL, false),
  ('tpl-2026-10-15-pm-17', 'PM', 17, 'Planning', 'Development estimation of Epics in story points, notify manager if estimate exceeds sales quote', NULL, false),
  ('tpl-2026-10-15-pm-18', 'PM', 18, 'Planning', 'Build WBS Level 1 (Epics, tabular format, sourced from proposal/RFP/contract) and load into PM tool', NULL, false),
  ('tpl-2026-10-15-pm-19', 'PM', 19, 'Planning', 'Set up WBS ID <-> SRS traceability (Product Backlog)', NULL, false),
  ('tpl-2026-10-15-pm-20', 'PM', 20, 'Planning', 'Upload final pre-development documents to the project repository', NULL, false),
  ('tpl-2026-10-15-pm-21', 'PM', 21, 'Planning', 'Hold project kickoff meeting with client present; celebrate with team/client/sales', 'Kickoff Complete', false),
  ('tpl-2026-10-15-pm-22', 'PM', 22, 'Planning', 'Hold backlog refinement / release planning meeting; add signed CRs to WBS', NULL, true),
  ('tpl-2026-10-15-pm-23', 'PM', 23, 'Planning', 'Hold sprint planning meeting; send SRS Sprint PDF to client', NULL, true),
  ('tpl-2026-10-15-pm-24', 'PM', 24, 'Approvals', 'Share SRS with the client (request sign-off/acknowledgement; do not block on it).', NULL, false),
  ('tpl-2026-10-15-pm-25', 'PM', 25, 'Approvals', 'Submit and obtain platform/app-store certification (Meta Quest Store, Apple Vision Pro, SteamVR)', 'Store Approved', false),
  ('tpl-2026-10-15-pm-26', 'PM', 26, 'Approvals', 'Obtain UAT sign-off from client', 'UAT Signed Off', false),
  ('tpl-2026-10-15-pm-27', 'PM', 27, 'Baselines', 'Confirm Feature Definition Sheet and scope boundaries with client', NULL, false),
  ('tpl-2026-10-15-pm-28', 'PM', 28, 'Baselines', 'Map each milestone (~1 month cadence) to a payment tranche and confirm the payment terms with the client', 'Payment Schedule Approved', false),
  ('tpl-2026-10-15-pm-29', 'PM', 29, 'Closure', 'Send completion & release report to stakeholders; raise invoice per payment schedule', NULL, false),
  ('tpl-2026-10-15-pm-30', 'PM', 30, 'Closure', 'Send Project Closure Report; obtain formal completion certificate', 'Project Closed', false),
  ('tpl-2026-10-15-pm-31', 'PM', 31, 'Closure', 'Conduct customer satisfaction survey', NULL, false),
  ('tpl-2026-10-15-pm-32', 'PM', 32, 'Closure', 'Deliver knowledge transfer package: domain video/doc plus technical documentation/video', NULL, false),
  ('tpl-2026-10-15-pm-33', 'PM', 33, 'Closure', 'Hand over credentials, accounts and infrastructure ownership to the client', NULL, false),
  ('tpl-2026-10-15-pm-34', 'PM', 34, 'Closure', 'Hold a lessons-learned session; record what to repeat and what to change', NULL, false),
  ('tpl-2026-10-15-pm-35', 'PM', 35, 'Closure', 'Revoke client and team access; archive the repos, PM tool and SharePoint space', NULL, false),
  ('tpl-2026-10-15-pm-36', 'PM', 36, 'Closure', 'Activate support/AMC terms per contract (after full payment)', NULL, false),
  ('tpl-2026-10-15-pm-37', 'PM', 37, 'Closure', 'Evaluate opportunity to transition from fixed-price to time & material model', NULL, false),
  ('tpl-2026-10-15-delivery-qa-01', 'DELIVERY_QA', 1, 'Test Planning', 'Define Definition of Done (DoD) checklist, including XR-specific criteria (device tested, performance budget met, asset validated)', NULL, false),
  ('tpl-2026-10-15-delivery-qa-02', 'DELIVERY_QA', 2, 'Test Planning', 'Define target performance budget per platform (FPS, draw calls, triangle/poly count, memory)—referenced by later Definition of Done and per-sprint device testing', NULL, false),
  ('tpl-2026-10-15-delivery-qa-03', 'DELIVERY_QA', 3, 'Test Planning', 'Write the test plan and test cases from the SRS acceptance criteria', NULL, false),
  ('tpl-2026-10-15-delivery-qa-04', 'DELIVERY_QA', 4, 'Test Planning', 'Set up the defect tracker with severity/priority definitions', NULL, false),
  ('tpl-2026-10-15-delivery-qa-05', 'DELIVERY_QA', 5, 'Functional Testing', 'Execute test cases; log and retest defects', NULL, true),
  ('tpl-2026-10-15-delivery-qa-06', 'DELIVERY_QA', 6, 'Functional Testing', 'Complete a functional test pass on the release candidate (all critical/high cases passed)', NULL, false),
  ('tpl-2026-10-15-delivery-qa-07', 'DELIVERY_QA', 7, 'Device Testing', 'Run device-level testing each sprint (FPS, draw calls, shader complexity)', NULL, true),
  ('tpl-2026-10-15-delivery-qa-08', 'DELIVERY_QA', 8, 'Device Testing', 'Run comfort & accessibility QA each sprint (motion sickness, colorblind mode, seated/standing, subtitles)', NULL, true),
  ('tpl-2026-10-15-delivery-qa-09', 'DELIVERY_QA', 9, 'Device Testing', 'Complete a device test pass on every target headset/platform within the performance budget', NULL, false),
  ('tpl-2026-10-15-delivery-qa-10', 'DELIVERY_QA', 10, 'Regression', 'Run full regression on the release candidate; no open critical/high defects', NULL, false),
  ('tpl-2026-10-15-delivery-qa-11', 'DELIVERY_QA', 11, 'UAT', 'Prepare the UAT plan, scripts and build for the client', NULL, false),
  ('tpl-2026-10-15-delivery-qa-12', 'DELIVERY_QA', 12, 'UAT', 'Triage UAT feedback; fix and retest UAT defects before sign-off', NULL, false),
  ('tpl-2026-10-15-devops-01', 'DEVOPS', 1, 'Infrastructure', 'Create a Git repository AND set up asset version control for large files.', 'Repos Ready', false),
  ('tpl-2026-10-15-devops-02', 'DEVOPS', 2, 'Infrastructure', 'Provision cloud infrastructure as code (Terraform/Bicep/ARM)', NULL, false),
  ('tpl-2026-10-15-devops-03', 'DEVOPS', 3, 'Infrastructure', 'Set up Dev / Staging / Production environments', NULL, false),
  ('tpl-2026-10-15-devops-04', 'DEVOPS', 4, 'Infrastructure', 'Containerize services (Docker) and set up registry', NULL, false),
  ('tpl-2026-10-15-devops-05', 'DEVOPS', 5, 'Infrastructure', 'Set up orchestration (Kubernetes / Container Apps / App Service)', NULL, false),
  ('tpl-2026-10-15-devops-06', 'DEVOPS', 6, 'Infrastructure', 'Register domains and set up SSL certificates with renewal reminders', NULL, false),
  ('tpl-2026-10-15-devops-07', 'DEVOPS', 7, 'CI/CD', 'Define branching strategy & PR review process', NULL, false),
  ('tpl-2026-10-15-devops-08', 'DEVOPS', 8, 'CI/CD', 'Build CI pipeline (build, lint, unit test on PR)', 'CI Pipeline Green', false),
  ('tpl-2026-10-15-devops-09', 'DEVOPS', 9, 'CI/CD', 'Validate build pipeline (Unity to Android/iOS/PCVR/WebGL; AI model deployment infra; CDN for 3D assets).', NULL, false),
  ('tpl-2026-10-15-devops-10', 'DEVOPS', 10, 'CI/CD', 'Build CD pipeline (auto-deploy to Dev/Staging, gated Prod)', NULL, false),
  ('tpl-2026-10-15-devops-11', 'DEVOPS', 11, 'CI/CD', 'Set up automated integration/regression test stage', NULL, false),
  ('tpl-2026-10-15-devops-12', 'DEVOPS', 12, 'CI/CD', 'Deploy release candidate to UAT; run and pass smoke test', NULL, false),
  ('tpl-2026-10-15-devops-13', 'DEVOPS', 13, 'CI/CD', 'Schedule and execute production deployment; run smoke test and post-deploy verification in production', 'Go-Live', false),
  ('tpl-2026-10-15-devops-14', 'DEVOPS', 14, 'Security', 'Configure secrets management (Key Vault / Vault / SSM)', NULL, false),
  ('tpl-2026-10-15-devops-15', 'DEVOPS', 15, 'Security', 'Store app-signing keys and store/console credentials in the team vault', NULL, false),
  ('tpl-2026-10-15-devops-16', 'DEVOPS', 16, 'Security', 'Set up access control / least-privilege IAM roles', NULL, false),
  ('tpl-2026-10-15-devops-17', 'DEVOPS', 17, 'Security', 'Run SAST/DAST, dependency and mobile security scans (e.g. ZAP, MobSF)', NULL, false),
  ('tpl-2026-10-15-devops-18', 'DEVOPS', 18, 'Monitoring', 'Set up monitoring, logging & alerting (App Insights/Datadog/Grafana)', NULL, false),
  ('tpl-2026-10-15-devops-19', 'DEVOPS', 19, 'Monitoring', 'Set up cloud cost monitoring and budget alerts', NULL, false),
  ('tpl-2026-10-15-devops-20', 'DEVOPS', 20, 'Monitoring', 'Configure autoscaling & load balancing', NULL, false),
  ('tpl-2026-10-15-devops-21', 'DEVOPS', 21, 'Monitoring', 'Define backup & disaster recovery plan', NULL, false),
  ('tpl-2026-10-15-devops-22', 'DEVOPS', 22, 'Monitoring', 'Run load/performance testing pre-launch', NULL, false),
  ('tpl-2026-10-15-devops-23', 'DEVOPS', 23, 'Monitoring', 'Define release & rollback runbook', 'Release Process Approved', false),
  ('tpl-2026-10-15-devops-24', 'DEVOPS', 24, 'Monitoring', 'Set up incident response process & on-call rotation', NULL, false),
  ('tpl-2026-10-15-creative-xr-01', 'CREATIVE_XR', 1, 'Storyboard', 'Run the Creative Huddle workshop with the client: walk through concepts, validate the user journey, and agree on 3D asset direction.', NULL, false),
  ('tpl-2026-10-15-creative-xr-02', 'CREATIVE_XR', 2, 'Storyboard', 'Finalize Experience Flow / storyboard', 'Creative Direction Approved', false),
  ('tpl-2026-10-15-creative-xr-03', 'CREATIVE_XR', 3, '3D', 'Review 3D models, rigs and animations against the style reference', NULL, false),
  ('tpl-2026-10-15-creative-xr-04', 'CREATIVE_XR', 4, '3D', 'Get client approval of the key 3D assets', NULL, false),
  ('tpl-2026-10-15-creative-xr-05', 'CREATIVE_XR', 5, 'UX', 'Prepare Figma / 3D UX mockups', NULL, false),
  ('tpl-2026-10-15-creative-xr-06', 'CREATIVE_XR', 6, 'UX', 'Approve experience flow & interaction map.', 'Experience Flow Approved', false),
  ('tpl-2026-10-15-creative-xr-07', 'CREATIVE_XR', 7, 'Assets', 'Approve Visual Style Reference', NULL, false),
  ('tpl-2026-10-15-creative-xr-08', 'CREATIVE_XR', 8, 'Assets', 'Define assets plan; plan and validate environment graybox(UI/3D Assets)', NULL, false),
  ('tpl-2026-10-15-creative-xr-09', 'CREATIVE_XR', 9, 'XR Validation', 'Validate interactions and comfort on the target headsets with the creative lead', NULL, false),
  ('tpl-2026-10-15-creative-xr-10', 'CREATIVE_XR', 10, 'XR Validation', 'Check the build against the store content and design guidelines (Meta, Apple, Steam)', NULL, false),
  ('tpl-2026-10-15-dev-01', 'DEV', 1, 'Development Readiness', 'Technical approach approved', NULL, false),
  ('tpl-2026-10-15-dev-02', 'DEV', 2, 'Development Readiness', 'Architecture available', NULL, false),
  ('tpl-2026-10-15-dev-03', 'DEV', 3, 'Development Readiness', 'Required APIs/services available', NULL, false),
  ('tpl-2026-10-15-dev-04', 'DEV', 4, 'Development Readiness', 'Required assets available', NULL, false),
  ('tpl-2026-10-15-dev-05', 'DEV', 5, 'Development Execution', 'Development completed against requirements', NULL, false),
  ('tpl-2026-10-15-dev-06', 'DEV', 6, 'Development Execution', 'Run automated AI code review (Git Action) on every PR; senior dev manual review before merge', NULL, false),
  ('tpl-2026-10-15-dev-07', 'DEV', 7, 'Development Execution', 'Unit testing completed', NULL, false),
  ('tpl-2026-10-15-dev-08', 'DEV', 8, 'Development Execution', 'Validate asset imports (scale, naming, texture size); test API integration on staging; implement error handling/fallback', NULL, false),
  ('tpl-2026-10-15-dev-09', 'DEV', 9, 'Development Execution', 'Integration completed', NULL, false),
  ('tpl-2026-10-15-dev-10', 'DEV', 10, 'Development Execution', 'Security considerations reviewed', NULL, false),
  ('tpl-2026-10-15-dev-11', 'DEV', 11, 'Development Execution', 'Technical debt identified', NULL, false),
  ('tpl-2026-10-15-dev-12', 'DEV', 12, 'Development Execution', 'Sprint scope confirmed', NULL, true),
  ('tpl-2026-10-15-dev-13', 'DEV', 13, 'Quality Gate', 'Run final optimization pass (XR scenes, AI inference latency, backend API load)', NULL, false),
  ('tpl-2026-10-15-dev-14', 'DEV', 14, 'Quality Gate', 'Build generated successfully', NULL, false),
  ('tpl-2026-10-15-dev-15', 'DEV', 15, 'Quality Gate', 'Automated tests passed', NULL, false),
  ('tpl-2026-10-15-dev-16', 'DEV', 16, 'Quality Gate', 'Smoke test completed', NULL, false),
  ('tpl-2026-10-15-dev-17', 'DEV', 17, 'Quality Gate', 'Critical defects resolved', NULL, false),
  ('tpl-2026-10-15-dev-18', 'DEV', 18, 'Quality Gate', 'Regression completed', NULL, false),
  ('tpl-2026-10-15-dev-19', 'DEV', 19, 'Quality Gate', 'Performance requirements validated', NULL, false),
  ('tpl-2026-10-15-dev-20', 'DEV', 20, 'Quality Gate', 'Supported platform/device testing completed', NULL, false),
  ('tpl-2026-10-15-dev-21', 'DEV', 21, 'Quality Gate', 'Release candidate validated', NULL, false),
  ('tpl-2026-10-15-dev-22', 'DEV', 22, 'Development Completion', 'Feature acceptance completed', NULL, false),
  ('tpl-2026-10-15-dev-23', 'DEV', 23, 'Development Completion', 'Known issues recorded on the release (Delivery → Releases)', NULL, false),
  ('tpl-2026-10-15-dev-24', 'DEV', 24, 'Development Completion', 'Technical documentation completed', NULL, false),
  ('tpl-2026-10-15-dev-25', 'DEV', 25, 'Development Completion', 'Technical handover completed', NULL, false),
  ('tpl-2026-10-15-dev-26', 'DEV', 26, 'Development Completion', 'Sprint acceptance completed', NULL, true);
