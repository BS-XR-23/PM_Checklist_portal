-- QMS Phase 1 (docs/QMS_PLAN.md): the PM checklist moves to lifecycle stages,
-- every QMS-linked item gets its Q-references, and PM, Dev and DevOps titles
-- change as approved. Runs after 20261015120000_checklist_template_review,
-- whose wording it matches on.
--
-- Existing projects are reconciled conservatively:
--   * nothing a PM has touched is deleted (status, a date, owner, link, notes
--     or any link to a milestone/task/sprint/payment counts as touched);
--   * splits, merges and new items apply to ACTIVE projects only; archived
--     projects keep their numbers and wording, and only move to the new stages;
--   * a split's original keeps its status, owner, dates and link; the new part
--     starts Not Started, so no sign-off is claimed that nobody recorded;
--   * a merge removes an untouched duplicate. A touched one stays as its own
--     row, marked custom so the PM can delete it once they've reviewed it.
-- Presales items and items PMs added themselves are never reworded.

ALTER TABLE "ChecklistItem" ADD COLUMN "qmsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "qmsRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 1. How each existing PM item maps to the new list. "rank" is its position in
--    the new order; active_only holds wording that splits or merges an item.
CREATE TEMP TABLE _qms_pm_map (
  rank INT, match TEXT, stage TEXT, new_text TEXT, refs TEXT[], unsplit_refs TEXT[], recurring BOOLEAN, active_only BOOLEAN, merge_duplicate BOOLEAN
);
INSERT INTO _qms_pm_map (rank, match, stage, new_text, refs, unsplit_refs, recurring, active_only, merge_duplicate) VALUES
  (10,  'Collect RFP%',                                   'Initiation',  'Collect RFP, Proposal, Contract/PO, initiation email and pre-sales documents in the project repository', ARRAY['Q2'], ARRAY['Q2'], false, true, false),
  (11,  'Send project initiation email%',                 'Initiation',  NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, true),
  (20,  'Confirm client-approved platforms%',             'Initiation',  NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (30,  'Confirm data privacy%',                          'Initiation',  NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (40,  'Create MS Teams%',                               'Initiation',  NULL, ARRAY['Q1'], ARRAY['Q1'], false, false, false),
  (50,  'Onboard the team%',                              'Initiation',  NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (70,  'Complete and approve Definition of Ready%',      'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (80,  'Draft Project Management Plan%',                 'Planning',    'Prepare the Project Management Plan', ARRAY['Q4'], ARRAY['Q4'], false, false, false),
  (90,  'Conduct initial risk%',                          'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (100, 'Define fixed-budget contingency%',               'Planning',    'Define budget controls in the PM Plan: contingency %, CR rate, CPI/SPI thresholds', ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, true, false),
  (101, 'Define CR pricing basis%',                       'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, true),
  (102, 'Define budget/schedule overrun%',                'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, true),
  (110, 'Development estimation of Epics%',               'Planning',    'Estimate Epics in story points (1 SP = 1 man-day) and set the delivery timeline', ARRAY['Q5','Q6'], ARRAY['Q5','Q6','Q8'], false, true, false),
  (130, 'Build WBS Level 1%',                             'Planning',    'Build the WBS: Epics with IDs and estimates in tabular format, traceable to the SRS, loaded into the PM tool', ARRAY['Q9','Q10','Q11'], ARRAY['Q9','Q10','Q11'], false, true, false),
  (131, 'Set up WBS ID%',                                 'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, true),
  (150, 'Confirm Feature Definition Sheet%',              'Planning',    NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (160, 'Share SRS%',                                     'Planning',    'Share the SRS or sprint backlog version with the client', ARRAY['Q12'], ARRAY['Q12','Q13'], false, true, false),
  (180, 'Map each milestone%',                            'Kickoff',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (181, 'Review and confirm payment terms%',              'Kickoff',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (190, 'Hold project kickoff meeting%',                  'Kickoff',     NULL, ARRAY['Q14'], ARRAY['Q14'], false, false, false),
  (200, 'Upload final pre-development%',                  'Kickoff',     NULL, ARRAY['Q15'], ARRAY['Q15'], false, false, false),
  (220, 'Hold backlog refinement%',                       'Development', 'Hold backlog refinement with team, TL and client; confirm priorities', ARRAY['Q16','Q17'], ARRAY['Q7','Q16','Q17'], true, true, false),
  (230, 'Hold sprint planning meeting%',                  'Development', NULL, ARRAY['Q19'], ARRAY['Q19'], true, false, false),
  (250, 'Log daily standups%',                            'Development', 'Daily scrum file created and maintained; PM clock entries up to date', ARRAY['Q21','Q22','Q23'], ARRAY['Q21','Q22','Q23'], true, false, false),
  (260, 'Record and share sprint review demo%',           'Development', 'Hold sprint review with the client or send the update; share the demo; list bugs and improvements with estimates; update Done items in WBS', ARRAY['Q25','Q26','Q27'], ARRAY['Q25','Q26','Q27'], true, false, false),
  (270, 'Hold sprint retrospective%',                     'Development', 'Hold the retrospective and plan improvement tasks (minimum monthly)', ARRAY['Q28','Q29'], ARRAY['Q28','Q29'], true, false, false),
  (280, 'Update CPI/SPI report weekly%',                  'Development', 'Upload the weekly status report with CPI/SPI to ERP; escalate beyond the threshold', ARRAY['Q24','Q30','Q31'], ARRAY['Q24','Q30','Q31'], true, false, false),
  (290, 'Hold project status update meeting%',            'Development', NULL, ARRAY['Q32'], ARRAY['Q32'], true, false, false),
  (300, 'Submit and obtain platform%',                    'Release',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (310, 'Obtain UAT sign-off%',                           'Release',     NULL, ARRAY['Q38'], ARRAY['Q38'], false, false, false),
  (320, 'Send completion & release report%',              'Release',     'Send the completion and release report to stakeholders', ARRAY['Q35'], ARRAY['Q35'], false, true, false),
  (350, 'Send Project Closure Report%',                   'Closing',     'Send the Project Closure Report', ARRAY['Q41'], ARRAY['Q41','Q43'], false, true, false),
  (380, 'Conduct customer satisfaction survey%',          'Closing',     NULL, ARRAY['Q44'], ARRAY['Q44'], false, false, false),
  (390, 'Deliver knowledge transfer package%',            'Closing',     'Deliver domain KT (video and short document) and upload it to the project repository', ARRAY['Q45'], ARRAY['Q45'], false, false, false),
  (400, 'Hand over credentials%',                         'Closing',     'Hand over credentials and infrastructure; revoke access; archive repos, PM tool and SharePoint', ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, true, false),
  (401, 'Revoke client and team access%',                 'Closing',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, true),
  (410, 'Hold a lessons-learned%',                        'Closing',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (420, 'Activate support/AMC%',                          'Closing',     'Agree any maintenance; activate support/AMC per contract after full payment', ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false),
  (430, 'Evaluate opportunity%',                          'Closing',     NULL, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, false, false);

-- 2. Match once, on the old wording, before anything is reworded.
CREATE TEMP TABLE _qms_pm_match AS
SELECT ci."id", ci."projectId", p."status" = 'ACTIVE' AS is_active, m.*
FROM "ChecklistItem" ci
JOIN "Project" p ON p."id" = ci."projectId"
JOIN _qms_pm_map m ON ci."itemText" LIKE m.match
WHERE ci."type" = 'PM' AND ci."isCustom" = false AND ci."stage" <> 'Presales';

-- 3. Merges on ACTIVE projects: remove an untouched duplicate; a touched one
--    stays as its own row, deletable by the PM.
DELETE FROM "ChecklistItem" ci
USING _qms_pm_match x
WHERE ci."id" = x."id" AND x.merge_duplicate AND x.is_active
  AND ci."status" = 'NOT_STARTED'
  AND ci."plannedDate" IS NULL AND ci."actualDate" IS NULL
  AND ci."owner" IS NULL AND ci."ownerPersonId" IS NULL
  AND COALESCE(ci."notes", '') = '' AND COALESCE(ci."link", '') = ''
  AND ci."milestoneId" IS NULL AND ci."wbsTaskId" IS NULL AND ci."sprintId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "MilestonePayment" mp WHERE mp."checklistItemId" = ci."id");

UPDATE "ChecklistItem" ci SET "isCustom" = true
FROM _qms_pm_match x
WHERE ci."id" = x."id" AND x.merge_duplicate AND x.is_active;

-- 4. Stage, wording, Q-references and cadence flag.
UPDATE "ChecklistItem" ci
SET "stage" = x.stage,
    "itemText" = CASE WHEN x.new_text IS NOT NULL AND (x.is_active OR NOT x.active_only) THEN x.new_text ELSE ci."itemText" END,
    "qmsRefs" = CASE WHEN x.is_active OR NOT x.active_only THEN x.refs ELSE x.unsplit_refs END,
    "isRecurring" = ci."isRecurring" OR x.recurring
FROM _qms_pm_match x
WHERE ci."id" = x."id";

-- 5. Anything left in a retired stage (a PM's own item, say) moves to the
--    closest lifecycle stage.
UPDATE "ChecklistItem"
SET "stage" = CASE "stage"
  WHEN 'Governance' THEN 'Initiation'
  WHEN 'Baselines' THEN 'Planning'
  WHEN 'Approvals' THEN 'Release'
  WHEN 'Closure' THEN 'Closing'
END
WHERE "type" = 'PM' AND "stage" IN ('Governance', 'Baselines', 'Approvals', 'Closure');

-- 6. New items, for ACTIVE projects that already use the PM checklist.
CREATE TEMP TABLE _qms_pm_new (rank INT, stage TEXT, item_text TEXT, refs TEXT[], recurring BOOLEAN);
INSERT INTO _qms_pm_new (rank, stage, item_text, refs, recurring) VALUES
  (60,  'Initiation',  'Set up the agile board in the PM tool', ARRAY['Q3'], false),
  (120, 'Planning',    'Notify the line manager of any major deviation between sales and development estimates', ARRAY['Q8'], false),
  (140, 'Planning',    'Prepare the product backlog, milestone and release plan', ARRAY['Q7'], false),
  (170, 'Planning',    'Get client sign-off or acknowledgement of the SRS (don''t block on it)', ARRAY['Q13'], false),
  (210, 'Development', 'Confirm development is complete; break down any partial WBS items and get client confirmation', ARRAY[]::TEXT[], false),
  (240, 'Development', 'Get client acknowledgement of the sprint requirements and task list', ARRAY['Q18','Q20'], true),
  (250, 'Development', 'Daily scrum file created and maintained; PM clock entries up to date', ARRAY['Q21','Q22','Q23'], true),
  (330, 'Release',     'Raise the invoice per the payment schedule', ARRAY[]::TEXT[], false),
  (340, 'Release',     'Hold the release ceremony with the client', ARRAY['Q40'], false),
  (360, 'Closing',     'Obtain the formal completion certificate', ARRAY['Q43'], false),
  (370, 'Closing',     'Celebrate completion with the client; publish internally and externally if there is no NDA', ARRAY['Q42'], false);

-- 7. Rank every PM item in the new order, keeping a PM's own items after the
--    template items of their stage. Presales items keep their negative orders.
CREATE TEMP TABLE _qms_pm_rank AS
SELECT ci."id", ci."projectId", COALESCE(x.rank, 100000 + ci."order") AS rank
FROM "ChecklistItem" ci
LEFT JOIN _qms_pm_match x ON x."id" = ci."id"
WHERE ci."type" = 'PM' AND ci."stage" <> 'Presales';

-- @@unique([projectId, type, order]) is checked row by row, so move every
-- affected row well out of the way before writing the final numbers.
UPDATE "ChecklistItem" ci
SET "order" = -1000000 - ci."order"
FROM _qms_pm_rank r
WHERE ci."id" = r."id";

INSERT INTO "ChecklistItem" ("id", "projectId", "type", "order", "stage", "itemText", "status", "isCustom", "isRecurring", "qmsRefs")
SELECT 'cki-2026-11-06-' || md5(e."projectId" || n.item_text), e."projectId", 'PM', 1000000 + n.rank, n.stage, n.item_text, 'NOT_STARTED', false, n.recurring, n.refs
FROM (
  SELECT DISTINCT ci."projectId"
  FROM "ChecklistItem" ci
  JOIN "Project" p ON p."id" = ci."projectId"
  WHERE ci."type" = 'PM' AND p."status" = 'ACTIVE'
) e
CROSS JOIN _qms_pm_new n
WHERE NOT EXISTS (
  SELECT 1 FROM "ChecklistItem" x
  WHERE x."projectId" = e."projectId" AND x."type" = 'PM' AND x."itemText" = n.item_text
);

INSERT INTO _qms_pm_rank ("id", "projectId", rank)
SELECT ci."id", ci."projectId", ci."order" - 1000000
FROM "ChecklistItem" ci
WHERE ci."type" = 'PM' AND ci."order" >= 1000000;

WITH numbered AS (
  SELECT r."id", ROW_NUMBER() OVER (PARTITION BY r."projectId" ORDER BY r.rank) AS rn
  FROM _qms_pm_rank r
)
UPDATE "ChecklistItem" ci
SET "order" = n.rn
FROM numbered n
WHERE ci."id" = n."id";

DROP TABLE _qms_pm_rank;
DROP TABLE _qms_pm_new;
DROP TABLE _qms_pm_match;
DROP TABLE _qms_pm_map;

-- 8. Dev and DevOps: wording and Q-references, on project items and the
--    template alike.
UPDATE "ChecklistItem" SET "itemText" = 'Architecture document written and linked'
WHERE "type" = 'DEV' AND "isCustom" = false AND "itemText" = 'Architecture available';
UPDATE "ChecklistItem" SET "itemText" = 'README and technical documentation written and in the repository', "qmsRefs" = ARRAY['Q45']
WHERE "type" = 'DEV' AND "isCustom" = false AND "itemText" = 'Technical documentation completed';
UPDATE "ChecklistItem" SET "itemText" = 'Technical handover done, with maintenance video recorded', "qmsRefs" = ARRAY['Q45']
WHERE "type" = 'DEV' AND "isCustom" = false AND "itemText" = 'Technical handover completed';
UPDATE "ChecklistItem" SET "qmsRefs" = ARRAY['Q3']
WHERE "type" = 'DEVOPS' AND "isCustom" = false AND "itemText" LIKE 'Create%Git repository%';
UPDATE "ChecklistItem" SET "itemText" = 'Run SAST/DAST, dependency and mobile security scans (e.g. ZAP, MobSF) and record the result', "qmsRefs" = ARRAY['Q36']
WHERE "type" = 'DEVOPS' AND "isCustom" = false AND "itemText" LIKE 'Run SAST/DAST%';
UPDATE "ChecklistItem" SET "itemText" = 'Define the release and rollback runbook and deployment checklist', "qmsRefs" = ARRAY['Q37']
WHERE "type" = 'DEVOPS' AND "isCustom" = false AND "itemText" LIKE 'Define release & rollback runbook%';
UPDATE "ChecklistItem" SET "qmsRefs" = ARRAY['Q39']
WHERE "type" = 'DEVOPS' AND "isCustom" = false AND "itemText" LIKE 'Schedule and execute production deployment%';

UPDATE "ChecklistTemplateItem" SET "itemText" = 'Architecture document written and linked'
WHERE "type" = 'DEV' AND "itemText" = 'Architecture available';
UPDATE "ChecklistTemplateItem" SET "itemText" = 'README and technical documentation written and in the repository', "qmsRefs" = ARRAY['Q45']
WHERE "type" = 'DEV' AND "itemText" = 'Technical documentation completed';
UPDATE "ChecklistTemplateItem" SET "itemText" = 'Technical handover done, with maintenance video recorded', "qmsRefs" = ARRAY['Q45']
WHERE "type" = 'DEV' AND "itemText" = 'Technical handover completed';
UPDATE "ChecklistTemplateItem" SET "qmsRefs" = ARRAY['Q3']
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Create%Git repository%';
UPDATE "ChecklistTemplateItem" SET "itemText" = 'Run SAST/DAST, dependency and mobile security scans (e.g. ZAP, MobSF) and record the result', "qmsRefs" = ARRAY['Q36']
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Run SAST/DAST%';
UPDATE "ChecklistTemplateItem" SET "itemText" = 'Define the release and rollback runbook and deployment checklist', "qmsRefs" = ARRAY['Q37']
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Define release & rollback runbook%';
UPDATE "ChecklistTemplateItem" SET "qmsRefs" = ARRAY['Q39']
WHERE "type" = 'DEVOPS' AND "itemText" LIKE 'Schedule and execute production deployment%';

-- 9. The PM template (what new projects copy): replaced with the approved
--    list — identical to lib/seed-data.ts.
DELETE FROM "ChecklistTemplateItem" WHERE "type" = 'PM';
INSERT INTO "ChecklistTemplateItem" ("id", "type", "order", "stage", "itemText", "milestoneName", "isRecurring", "qmsRefs") VALUES
  ('tpl-2026-11-06-pm-01', 'PM', 1, 'Initiation', 'Collect RFP, Proposal, Contract/PO, initiation email and pre-sales documents in the project repository', NULL, false, ARRAY['Q2']),
  ('tpl-2026-11-06-pm-02', 'PM', 2, 'Initiation', 'Confirm client-approved platforms and performance expectations', 'Platforms Confirmed', false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-03', 'PM', 3, 'Initiation', 'Confirm data privacy and compliance requirements with the client (GDPR/HIPAA, data residency, consent)', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-04', 'PM', 4, 'Initiation', 'Create MS Teams channel and SharePoint space for the project', NULL, false, ARRAY['Q1']),
  ('tpl-2026-11-06-pm-05', 'PM', 5, 'Initiation', 'Onboard the team: tool and environment access, NDAs signed', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-06', 'PM', 6, 'Initiation', 'Set up the agile board in the PM tool', NULL, false, ARRAY['Q3']),
  ('tpl-2026-11-06-pm-07', 'PM', 7, 'Planning', 'Complete and approve Definition of Ready (DoR): requirement, design, backend/3rd-party API, performance/security requirement, target platform', 'DoR Approved', false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-08', 'PM', 8, 'Planning', 'Prepare the Project Management Plan', 'PMP Approved', false, ARRAY['Q4']),
  ('tpl-2026-11-06-pm-09', 'PM', 9, 'Planning', 'Conduct initial risk identification workshop; populate the Risk Register with top risks, severity, and mitigation owners', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-10', 'PM', 10, 'Planning', 'Define budget controls in the PM Plan: contingency %, CR rate, CPI/SPI thresholds', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-11', 'PM', 11, 'Planning', 'Estimate Epics in story points (1 SP = 1 man-day) and set the delivery timeline', NULL, false, ARRAY['Q5','Q6']),
  ('tpl-2026-11-06-pm-12', 'PM', 12, 'Planning', 'Notify the line manager of any major deviation between sales and development estimates', NULL, false, ARRAY['Q8']),
  ('tpl-2026-11-06-pm-13', 'PM', 13, 'Planning', 'Build the WBS: Epics with IDs and estimates in tabular format, traceable to the SRS, loaded into the PM tool', NULL, false, ARRAY['Q9','Q10','Q11']),
  ('tpl-2026-11-06-pm-14', 'PM', 14, 'Planning', 'Prepare the product backlog, milestone and release plan', NULL, false, ARRAY['Q7']),
  ('tpl-2026-11-06-pm-15', 'PM', 15, 'Planning', 'Confirm Feature Definition Sheet and scope boundaries with client', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-16', 'PM', 16, 'Planning', 'Share the SRS or sprint backlog version with the client', NULL, false, ARRAY['Q12']),
  ('tpl-2026-11-06-pm-17', 'PM', 17, 'Planning', 'Get client sign-off or acknowledgement of the SRS (don''t block on it)', NULL, false, ARRAY['Q13']),
  ('tpl-2026-11-06-pm-18', 'PM', 18, 'Kickoff', 'Map each milestone (~1 month cadence) to a payment tranche and confirm the payment terms with the client', 'Payment Schedule Approved', false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-19', 'PM', 19, 'Kickoff', 'Hold project kickoff meeting with client present; celebrate with team/client/sales', 'Kickoff Complete', false, ARRAY['Q14']),
  ('tpl-2026-11-06-pm-20', 'PM', 20, 'Kickoff', 'Upload final pre-development documents to the project repository', NULL, false, ARRAY['Q15']),
  ('tpl-2026-11-06-pm-21', 'PM', 21, 'Development', 'Confirm development is complete; break down any partial WBS items and get client confirmation', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-22', 'PM', 22, 'Development', 'Hold backlog refinement with team, TL and client; confirm priorities', NULL, true, ARRAY['Q16','Q17']),
  ('tpl-2026-11-06-pm-23', 'PM', 23, 'Development', 'Hold sprint planning meeting; send SRS Sprint PDF to client', NULL, true, ARRAY['Q19']),
  ('tpl-2026-11-06-pm-24', 'PM', 24, 'Development', 'Get client acknowledgement of the sprint requirements and task list', NULL, true, ARRAY['Q18','Q20']),
  ('tpl-2026-11-06-pm-25', 'PM', 25, 'Development', 'Daily scrum file created and maintained; PM clock entries up to date', NULL, true, ARRAY['Q21','Q22','Q23']),
  ('tpl-2026-11-06-pm-26', 'PM', 26, 'Development', 'Hold sprint review with the client or send the update; share the demo; list bugs and improvements with estimates; update Done items in WBS', NULL, true, ARRAY['Q25','Q26','Q27']),
  ('tpl-2026-11-06-pm-27', 'PM', 27, 'Development', 'Hold the retrospective and plan improvement tasks (minimum monthly)', NULL, true, ARRAY['Q28','Q29']),
  ('tpl-2026-11-06-pm-28', 'PM', 28, 'Development', 'Upload the weekly status report with CPI/SPI to ERP; escalate beyond the threshold', NULL, true, ARRAY['Q24','Q30','Q31']),
  ('tpl-2026-11-06-pm-29', 'PM', 29, 'Development', 'Hold project status update meeting (minimum monthly, twice preferred)', NULL, true, ARRAY['Q32']),
  ('tpl-2026-11-06-pm-30', 'PM', 30, 'Release', 'Submit and obtain platform/app-store certification (Meta Quest Store, Apple Vision Pro, SteamVR)', 'Store Approved', false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-31', 'PM', 31, 'Release', 'Obtain UAT sign-off from client', 'UAT Signed Off', false, ARRAY['Q38']),
  ('tpl-2026-11-06-pm-32', 'PM', 32, 'Release', 'Send the completion and release report to stakeholders', NULL, false, ARRAY['Q35']),
  ('tpl-2026-11-06-pm-33', 'PM', 33, 'Release', 'Raise the invoice per the payment schedule', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-34', 'PM', 34, 'Release', 'Hold the release ceremony with the client', NULL, false, ARRAY['Q40']),
  ('tpl-2026-11-06-pm-35', 'PM', 35, 'Closing', 'Send the Project Closure Report', 'Project Closed', false, ARRAY['Q41']),
  ('tpl-2026-11-06-pm-36', 'PM', 36, 'Closing', 'Obtain the formal completion certificate', NULL, false, ARRAY['Q43']),
  ('tpl-2026-11-06-pm-37', 'PM', 37, 'Closing', 'Celebrate completion with the client; publish internally and externally if there is no NDA', NULL, false, ARRAY['Q42']),
  ('tpl-2026-11-06-pm-38', 'PM', 38, 'Closing', 'Conduct customer satisfaction survey', NULL, false, ARRAY['Q44']),
  ('tpl-2026-11-06-pm-39', 'PM', 39, 'Closing', 'Deliver domain KT (video and short document) and upload it to the project repository', NULL, false, ARRAY['Q45']),
  ('tpl-2026-11-06-pm-40', 'PM', 40, 'Closing', 'Hand over credentials and infrastructure; revoke access; archive repos, PM tool and SharePoint', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-41', 'PM', 41, 'Closing', 'Hold a lessons-learned session; record what to repeat and what to change', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-42', 'PM', 42, 'Closing', 'Agree any maintenance; activate support/AMC per contract after full payment', NULL, false, ARRAY[]::TEXT[]),
  ('tpl-2026-11-06-pm-43', 'PM', 43, 'Closing', 'Evaluate opportunity to transition from fixed-price to time & material model', NULL, false, ARRAY[]::TEXT[]);
