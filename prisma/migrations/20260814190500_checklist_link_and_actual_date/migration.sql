-- Rename, not drop+add: ChecklistItem.forecastDate has 81 existing non-null
-- values in this shared dev/prod database. A rename preserves that data;
-- the auto-generated migration would have dropped the column and lost it.
ALTER TABLE "ChecklistItem" RENAME COLUMN "forecastDate" TO "actualDate";

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN "link" TEXT;
