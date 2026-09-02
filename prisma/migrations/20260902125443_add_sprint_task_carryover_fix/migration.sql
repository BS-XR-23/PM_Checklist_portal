-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "departedTaskSnapshot" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "WbsTask" ADD COLUMN     "sprintEntryHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
