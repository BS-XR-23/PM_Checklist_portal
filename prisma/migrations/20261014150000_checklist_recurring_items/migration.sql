-- Phase 4 (docs/FIX_PLAN.md): recurring cadence activities (weekly CPI/SPI
-- report, monthly retro, ...) can never be "completed", so they kept every
-- project's current stage stuck on Governance and dragged completion %.
-- Additive: a boolean column (default false) on the template and on project
-- checklist items, then flag the five known cadence items by exact text.

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false;


-- Flag the known cadence items (template + every existing project's copy).
UPDATE "ChecklistTemplateItem" SET "isRecurring" = true WHERE "itemText" IN (
  'Log daily standups and time entries in PM tool',
  'Record and share sprint review demo with client and stakeholders',
  'Update CPI/SPI report weekly; escalate if beyond defined threshold',
  'Hold sprint retrospective (minimum monthly)',
  'Hold project status update meeting (minimum monthly, twice preferred)'
);
UPDATE "ChecklistItem" SET "isRecurring" = true WHERE "itemText" IN (
  'Log daily standups and time entries in PM tool',
  'Record and share sprint review demo with client and stakeholders',
  'Update CPI/SPI report weekly; escalate if beyond defined threshold',
  'Hold sprint retrospective (minimum monthly)',
  'Hold project status update meeting (minimum monthly, twice preferred)'
);

-- Retire the PM checklist's "Gates" stage (two unrelated items) so "gate"
-- means only PM Plan's G0-G6 framework: kickoff moves to Planning, anything
-- else in it (store certification, plus any PM-added custom item) to Approvals.
UPDATE "ChecklistTemplateItem" SET "stage" = 'Planning'
  WHERE "type" = 'PM' AND "stage" = 'Gates' AND "itemText" LIKE 'Hold project kickoff meeting%';
UPDATE "ChecklistTemplateItem" SET "stage" = 'Approvals' WHERE "type" = 'PM' AND "stage" = 'Gates';
UPDATE "ChecklistItem" SET "stage" = 'Planning'
  WHERE "type" = 'PM' AND "stage" = 'Gates' AND "itemText" LIKE 'Hold project kickoff meeting%';
UPDATE "ChecklistItem" SET "stage" = 'Approvals' WHERE "type" = 'PM' AND "stage" = 'Gates';
