-- Data-only migration: creates one Milestone row per existing
-- milestone-tagged ChecklistItem (ChecklistItem.milestoneName IS NOT NULL),
-- and links both the ChecklistItem and its paired MilestonePayment (if any)
-- to the new row. Deterministic id ('ms_' || checklist item id) makes this
-- migration idempotent-checkable and needs no correlated INSERT...RETURNING
-- round trip. Default type DEVELOPMENT is a reasonable placeholder — PMs can
-- reclassify via the new Milestones UI afterward, this migration's only job
-- is not to lose data. Does not touch ChecklistItem.milestoneName or
-- MilestonePayment.checklistItemId — both stay populated as the existing
-- source of truth until a later migration tightens MilestonePayment to
-- anchor on milestoneId instead (see schema.prisma comment on
-- MilestonePayment.milestoneId).

INSERT INTO "Milestone" (id, "projectId", name, type, status, "pctComplete", "plannedDate", "actualDate", "ownerPersonId", "createdAt", "updatedAt")
SELECT 'ms_' || ci.id, ci."projectId", ci."milestoneName", 'DEVELOPMENT', ci.status,
       CASE WHEN ci.status = 'COMPLETED' THEN 1 ELSE 0 END,
       ci."plannedDate", ci."actualDate", ci."ownerPersonId", now(), now()
FROM "ChecklistItem" ci
WHERE ci."milestoneName" IS NOT NULL;

UPDATE "ChecklistItem" SET "milestoneId" = 'ms_' || id WHERE "milestoneName" IS NOT NULL;

UPDATE "MilestonePayment" mp
SET "milestoneId" = 'ms_' || ci.id
FROM "ChecklistItem" ci
WHERE mp."checklistItemId" = ci.id AND ci."milestoneName" IS NOT NULL;
