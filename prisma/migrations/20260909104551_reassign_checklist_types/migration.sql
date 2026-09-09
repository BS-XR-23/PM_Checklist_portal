-- Data-only migration: reassigns existing PM_CHECKLIST_SEED items (and 2
-- template rows added after that seed, orders 52/53) into the new 5-checklist
-- structure (PM/Engineering/QA/DevOps/Creative-XR), and recategorizes the 18
-- DevOps items from 5 categories into the consolidated 4. Mapping approved by
-- the user; source-of-truth generator kept at
-- scripts/checklist-type-reassignment-map.mjs for rollback (swap old/new and
-- rerun). Must ship in the same deploy as the PM_STAGES/DEVOPS_CATEGORIES
-- content change in lib/seed-data.ts — the stage-matching in
-- currentStage()/ChecklistTable is exact-string, no fallback, so code and
-- data cannot be desynchronized even briefly or every checklist tab goes
-- silently blank.
-- isCustom = false guards every ChecklistItem UPDATE — user-added items are
-- never touched, only rows copied from the original template.
-- Items moving into DEVOPS (already-populated: orders 1-18) are also given
-- fresh order values 19-23 to avoid the unique(type, order) constraint —
-- confirmed necessary the hard way (first attempt at this migration failed
-- with exactly that collision). Items moving into ENGINEERING/QA/CREATIVE_XR
-- (previously empty) keep their original order values unchanged.


UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 1;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 1 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 2;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 2 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 3;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 3 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 4;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 4 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'DEVOPS', stage = 'Infrastructure', "order" = 19 WHERE type = 'PM' AND "order" = 5;
UPDATE "ChecklistItem" SET type = 'DEVOPS', stage = 'Infrastructure', "order" = 19 WHERE type = 'PM' AND "order" = 5 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 6;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 6 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 7;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 7 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 8;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 8 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 9;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 9 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 10;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 10 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 11;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 11 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 12;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 12 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 13;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 13 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 14;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 14 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = 'UX' WHERE type = 'PM' AND "order" = 15;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = 'UX' WHERE type = 'PM' AND "order" = 15 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = '3D' WHERE type = 'PM' AND "order" = 16;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = '3D' WHERE type = 'PM' AND "order" = 16 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = 'UX' WHERE type = 'PM' AND "order" = 17;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = 'UX' WHERE type = 'PM' AND "order" = 17 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'QA', stage = 'Test Planning' WHERE type = 'PM' AND "order" = 18;
UPDATE "ChecklistItem" SET type = 'QA', stage = 'Test Planning' WHERE type = 'PM' AND "order" = 18 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Gates' WHERE type = 'PM' AND "order" = 19;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Gates' WHERE type = 'PM' AND "order" = 19 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Approvals' WHERE type = 'PM' AND "order" = 20;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Approvals' WHERE type = 'PM' AND "order" = 20 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 21;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 21 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 22;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 22 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = 'Storyboard' WHERE type = 'PM' AND "order" = 23;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = 'Storyboard' WHERE type = 'PM' AND "order" = 23 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = 'Storyboard' WHERE type = 'PM' AND "order" = 24;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = 'Storyboard' WHERE type = 'PM' AND "order" = 24 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'CREATIVE_XR', stage = 'Assets' WHERE type = 'PM' AND "order" = 25;
UPDATE "ChecklistItem" SET type = 'CREATIVE_XR', stage = 'Assets' WHERE type = 'PM' AND "order" = 25 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 26;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Baselines' WHERE type = 'PM' AND "order" = 26 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 27;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 27 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 28;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 28 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 29;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 29 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'ENGINEERING', stage = 'Code Review' WHERE type = 'PM' AND "order" = 30;
UPDATE "ChecklistItem" SET type = 'ENGINEERING', stage = 'Code Review' WHERE type = 'PM' AND "order" = 30 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'QA', stage = 'Device Testing' WHERE type = 'PM' AND "order" = 31;
UPDATE "ChecklistItem" SET type = 'QA', stage = 'Device Testing' WHERE type = 'PM' AND "order" = 31 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'QA', stage = 'Functional Testing' WHERE type = 'PM' AND "order" = 32;
UPDATE "ChecklistItem" SET type = 'QA', stage = 'Functional Testing' WHERE type = 'PM' AND "order" = 32 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'ENGINEERING', stage = 'Development' WHERE type = 'PM' AND "order" = 33;
UPDATE "ChecklistItem" SET type = 'ENGINEERING', stage = 'Development' WHERE type = 'PM' AND "order" = 33 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'QA', stage = 'Functional Testing' WHERE type = 'PM' AND "order" = 34;
UPDATE "ChecklistItem" SET type = 'QA', stage = 'Functional Testing' WHERE type = 'PM' AND "order" = 34 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 35;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 35 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 36;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 36 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 37;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 37 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 38;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Governance' WHERE type = 'PM' AND "order" = 38 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 20 WHERE type = 'PM' AND "order" = 39;
UPDATE "ChecklistItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 20 WHERE type = 'PM' AND "order" = 39 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 21 WHERE type = 'PM' AND "order" = 40;
UPDATE "ChecklistItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 21 WHERE type = 'PM' AND "order" = 40 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'ENGINEERING', stage = 'Performance' WHERE type = 'PM' AND "order" = 41;
UPDATE "ChecklistItem" SET type = 'ENGINEERING', stage = 'Performance' WHERE type = 'PM' AND "order" = 41 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'DEVOPS', stage = 'Security', "order" = 22 WHERE type = 'PM' AND "order" = 42;
UPDATE "ChecklistItem" SET type = 'DEVOPS', stage = 'Security', "order" = 22 WHERE type = 'PM' AND "order" = 42 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Gates' WHERE type = 'PM' AND "order" = 43;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Gates' WHERE type = 'PM' AND "order" = 43 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Approvals' WHERE type = 'PM' AND "order" = 44;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Approvals' WHERE type = 'PM' AND "order" = 44 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 23 WHERE type = 'PM' AND "order" = 45;
UPDATE "ChecklistItem" SET type = 'DEVOPS', stage = 'CI/CD', "order" = 23 WHERE type = 'PM' AND "order" = 45 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 46;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 46 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 47;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 47 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 48;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 48 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 49;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 49 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 50;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 50 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 51;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Closure' WHERE type = 'PM' AND "order" = 51 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 52;
UPDATE "ChecklistItem" SET type = 'PM', stage = 'Planning' WHERE type = 'PM' AND "order" = 52 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET type = 'QA', stage = 'Test Planning' WHERE type = 'PM' AND "order" = 53;
UPDATE "ChecklistItem" SET type = 'QA', stage = 'Test Planning' WHERE type = 'PM' AND "order" = 53 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 1;
UPDATE "ChecklistItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 1 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 2;
UPDATE "ChecklistItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 2 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 3;
UPDATE "ChecklistItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 3 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 4;
UPDATE "ChecklistItem" SET stage = 'Infrastructure' WHERE type = 'DEVOPS' AND "order" = 4 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 5;
UPDATE "ChecklistItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 5 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 6;
UPDATE "ChecklistItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 6 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 7;
UPDATE "ChecklistItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 7 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 8;
UPDATE "ChecklistItem" SET stage = 'CI/CD' WHERE type = 'DEVOPS' AND "order" = 8 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 9;
UPDATE "ChecklistItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 9 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 10;
UPDATE "ChecklistItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 10 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 11;
UPDATE "ChecklistItem" SET stage = 'Security' WHERE type = 'DEVOPS' AND "order" = 11 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 12;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 12 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 13;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 13 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 14;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 14 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 15;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 15 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 16;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 16 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 17;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 17 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 18;
UPDATE "ChecklistItem" SET stage = 'Monitoring' WHERE type = 'DEVOPS' AND "order" = 18 AND "isCustom" = false;
