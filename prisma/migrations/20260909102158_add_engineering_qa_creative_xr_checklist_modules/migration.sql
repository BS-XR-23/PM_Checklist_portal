-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModuleName" ADD VALUE 'ENGINEERING_CHECKLIST';
ALTER TYPE "ModuleName" ADD VALUE 'QA_CHECKLIST';
ALTER TYPE "ModuleName" ADD VALUE 'CREATIVE_XR_CHECKLIST';
