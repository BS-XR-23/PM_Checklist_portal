-- Phase 3 (docs/FIX_PLAN.md): a payment tranche belongs to a client-facing
-- Milestone, not to a checklist "gate" item. Schema-only and backward
-- compatible — no rows are changed here. Data cleanup of the gate-copied
-- milestones is a separate, reviewed step: scripts/milestone-cleanup.ts.
--
-- checklistItemId becomes optional (legacy link, SET NULL if the checklist
-- item is deleted) and deleting a Milestone now deletes its payment row.

-- DropForeignKey
ALTER TABLE "MilestonePayment" DROP CONSTRAINT "MilestonePayment_checklistItemId_fkey";

-- DropForeignKey
ALTER TABLE "MilestonePayment" DROP CONSTRAINT "MilestonePayment_milestoneId_fkey";

-- AlterTable
ALTER TABLE "MilestonePayment" ALTER COLUMN "checklistItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MilestonePayment" ADD CONSTRAINT "MilestonePayment_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestonePayment" ADD CONSTRAINT "MilestonePayment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

