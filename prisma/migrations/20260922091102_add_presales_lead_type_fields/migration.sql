-- CreateEnum
CREATE TYPE "PresalesLeadType" AS ENUM ('FIXED_BUDGET', 'RESOURCE_AUGMENTATION', 'TIME_AND_MATERIAL');

-- AlterTable
ALTER TABLE "PresalesProject" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "salesContact" TEXT,
ADD COLUMN "estimatedBy" TEXT,
ADD COLUMN "leadType" "PresalesLeadType";
