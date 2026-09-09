-- Data-only migration: consolidates sparse single-item stages that resulted
-- from the reassign_checklist_types migration — Engineering/QA/Creative-XR
-- ended up with several stages holding just 1 item each, which reads as
-- over-structured. No type/order changes here (only stage), so unlike that
-- prior migration there is no unique(type, order) collision risk and no
-- stage-vocabulary removal — every target stage name already exists in
-- ENGINEERING_STAGES/QA_STAGES/CREATIVE_XR_STAGES (lib/seed-data.ts), so this
-- is safe to apply without the strict same-deploy atomicity the prior
-- migration required.
--
-- Engineering: Code Review + Performance folded into Development (3 items,
-- 1 stage instead of 3).
UPDATE "ChecklistTemplateItem" SET stage = 'Development' WHERE type = 'ENGINEERING' AND "order" = 30;
UPDATE "ChecklistItem" SET stage = 'Development' WHERE type = 'ENGINEERING' AND "order" = 30 AND "isCustom" = false;
UPDATE "ChecklistTemplateItem" SET stage = 'Development' WHERE type = 'ENGINEERING' AND "order" = 41;
UPDATE "ChecklistItem" SET stage = 'Development' WHERE type = 'ENGINEERING' AND "order" = 41 AND "isCustom" = false;

-- QA: Device Testing folded into Functional Testing (5 items, 2 stages
-- instead of 3: Test Planning 2, Functional Testing 3).
UPDATE "ChecklistTemplateItem" SET stage = 'Functional Testing' WHERE type = 'QA' AND "order" = 31;
UPDATE "ChecklistItem" SET stage = 'Functional Testing' WHERE type = 'QA' AND "order" = 31 AND "isCustom" = false;

-- Creative & XR: 3D folded into Assets (6 items, 3 balanced stages instead
-- of 4: Storyboard 2, UX 2, Assets 2).
UPDATE "ChecklistTemplateItem" SET stage = 'Assets' WHERE type = 'CREATIVE_XR' AND "order" = 16;
UPDATE "ChecklistItem" SET stage = 'Assets' WHERE type = 'CREATIVE_XR' AND "order" = 16 AND "isCustom" = false;
