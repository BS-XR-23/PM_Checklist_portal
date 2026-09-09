-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('PLANNING', 'DESIGN', 'DEVELOPMENT', 'QA', 'UAT', 'RELEASE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('INTERNAL', 'DEVELOPMENT', 'QA', 'STAGING', 'UAT', 'PRODUCTION', 'HOTFIX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModuleName" ADD VALUE 'DEV_CHECKLIST';
ALTER TYPE "ModuleName" ADD VALUE 'RELEASE';
ALTER TYPE "ModuleName" ADD VALUE 'UAT';

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "milestoneId" TEXT,
ADD COLUMN     "sprintId" TEXT,
ADD COLUMN     "wbsTaskId" TEXT;

-- AlterTable
ALTER TABLE "MilestonePayment" ADD COLUMN     "milestoneId" TEXT;

-- AlterTable
ALTER TABLE "WbsTask" ADD COLUMN     "milestoneId" TEXT;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL DEFAULT 'DEVELOPMENT',
    "description" TEXT,
    "plannedDate" TIMESTAMP(3),
    "forecastDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownerPersonId" TEXT,
    "acceptanceCriteria" TEXT,
    "dependenciesNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneDependency" (
    "id" TEXT NOT NULL,
    "blockedMilestoneId" TEXT NOT NULL,
    "blockingMilestoneId" TEXT NOT NULL,

    CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneSprint" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,

    CONSTRAINT "MilestoneSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL DEFAULT 'INTERNAL',
    "environment" TEXT,
    "releaseDate" TIMESTAMP(3),
    "ownerPersonId" TEXT,
    "relatedMilestoneId" TEXT,
    "buildNumber" TEXT,
    "releaseNotes" TEXT,
    "deploymentStatus" TEXT NOT NULL DEFAULT 'Planned',
    "rollbackVersion" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'Pending',
    "postReleaseValidation" TEXT,
    "knownIssues" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseSprint" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,

    CONSTRAINT "ReleaseSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseWbsTask" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "wbsTaskId" TEXT NOT NULL,

    CONSTRAINT "ReleaseWbsTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UatCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "releaseId" TEXT,
    "milestoneId" TEXT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "scenario" TEXT,
    "preconditions" TEXT,
    "steps" TEXT,
    "expectedResult" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "ownerPersonId" TEXT,
    "executedDate" TIMESTAMP(3),
    "actualResult" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UatCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UatDefect" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uatCaseId" TEXT,
    "releaseId" TEXT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "ownerPersonId" TEXT,
    "reportedDate" TIMESTAMP(3),
    "targetFixDate" TIMESTAMP(3),
    "retestResult" TEXT,
    "closedDate" TIMESTAMP(3),
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UatDefect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDependency_blockedMilestoneId_blockingMilestoneId_key" ON "MilestoneDependency"("blockedMilestoneId", "blockingMilestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneSprint_milestoneId_sprintId_key" ON "MilestoneSprint"("milestoneId", "sprintId");

-- CreateIndex
CREATE INDEX "Release_projectId_idx" ON "Release"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_projectId_version_key" ON "Release"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseSprint_releaseId_sprintId_key" ON "ReleaseSprint"("releaseId", "sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseWbsTask_releaseId_wbsTaskId_key" ON "ReleaseWbsTask"("releaseId", "wbsTaskId");

-- CreateIndex
CREATE INDEX "UatCase_projectId_idx" ON "UatCase"("projectId");

-- CreateIndex
CREATE INDEX "UatCase_releaseId_idx" ON "UatCase"("releaseId");

-- CreateIndex
CREATE INDEX "UatDefect_projectId_idx" ON "UatDefect"("projectId");

-- CreateIndex
CREATE INDEX "UatDefect_uatCaseId_idx" ON "UatDefect"("uatCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestonePayment_milestoneId_key" ON "MilestonePayment"("milestoneId");

-- CreateIndex
CREATE INDEX "WbsTask_milestoneId_idx" ON "WbsTask"("milestoneId");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_wbsTaskId_fkey" FOREIGN KEY ("wbsTaskId") REFERENCES "WbsTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestonePayment" ADD CONSTRAINT "MilestonePayment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_blockedMilestoneId_fkey" FOREIGN KEY ("blockedMilestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_blockingMilestoneId_fkey" FOREIGN KEY ("blockingMilestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSprint" ADD CONSTRAINT "MilestoneSprint_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSprint" ADD CONSTRAINT "MilestoneSprint_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_relatedMilestoneId_fkey" FOREIGN KEY ("relatedMilestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseSprint" ADD CONSTRAINT "ReleaseSprint_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseSprint" ADD CONSTRAINT "ReleaseSprint_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWbsTask" ADD CONSTRAINT "ReleaseWbsTask_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWbsTask" ADD CONSTRAINT "ReleaseWbsTask_wbsTaskId_fkey" FOREIGN KEY ("wbsTaskId") REFERENCES "WbsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatCase" ADD CONSTRAINT "UatCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatCase" ADD CONSTRAINT "UatCase_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatCase" ADD CONSTRAINT "UatCase_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatCase" ADD CONSTRAINT "UatCase_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatDefect" ADD CONSTRAINT "UatDefect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatDefect" ADD CONSTRAINT "UatDefect_uatCaseId_fkey" FOREIGN KEY ("uatCaseId") REFERENCES "UatCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatDefect" ADD CONSTRAINT "UatDefect_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UatDefect" ADD CONSTRAINT "UatDefect_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

