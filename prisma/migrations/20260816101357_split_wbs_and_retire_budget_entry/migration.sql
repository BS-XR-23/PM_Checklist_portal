/*
  Warnings:

  - You are about to drop the column `actualManDays` on the `WbsTask` table. All the data in the column will be lost.
  - You are about to drop the column `competencyMultiplier` on the `WbsTask` table. All the data in the column will be lost.
  - You are about to drop the column `pctComplete` on the `WbsTask` table. All the data in the column will be lost.
  - You are about to drop the column `wbsWeekId` on the `WbsTask` table. All the data in the column will be lost.
  - You are about to drop the `BudgetEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BudgetEntryRoleCost` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `projectId` to the `WbsTask` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BudgetEntry" DROP CONSTRAINT "BudgetEntry_projectId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetEntryRoleCost" DROP CONSTRAINT "BudgetEntryRoleCost_budgetEntryId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetEntryRoleCost" DROP CONSTRAINT "BudgetEntryRoleCost_personId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetEntryRoleCost" DROP CONSTRAINT "BudgetEntryRoleCost_roleRateId_fkey";

-- DropForeignKey
ALTER TABLE "WbsTask" DROP CONSTRAINT "WbsTask_wbsWeekId_fkey";

-- DropIndex
DROP INDEX "WbsTask_wbsWeekId_idx";

-- AlterTable
ALTER TABLE "WbsTask" DROP COLUMN "actualManDays",
DROP COLUMN "competencyMultiplier",
DROP COLUMN "pctComplete",
DROP COLUMN "wbsWeekId",
ADD COLUMN     "projectId" TEXT NOT NULL;

-- DropTable
DROP TABLE "BudgetEntry";

-- DropTable
DROP TABLE "BudgetEntryRoleCost";

-- CreateTable
CREATE TABLE "WbsWeekEntry" (
    "id" TEXT NOT NULL,
    "wbsWeekId" TEXT NOT NULL,
    "wbsTaskId" TEXT NOT NULL,
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualManDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "personId" TEXT,
    "personName" TEXT,
    "competencyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WbsWeekEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WbsWeekEntry_wbsWeekId_idx" ON "WbsWeekEntry"("wbsWeekId");

-- CreateIndex
CREATE INDEX "WbsWeekEntry_wbsTaskId_idx" ON "WbsWeekEntry"("wbsTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "WbsWeekEntry_wbsWeekId_wbsTaskId_key" ON "WbsWeekEntry"("wbsWeekId", "wbsTaskId");

-- CreateIndex
CREATE INDEX "WbsTask_projectId_idx" ON "WbsTask"("projectId");

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsWeekEntry" ADD CONSTRAINT "WbsWeekEntry_wbsWeekId_fkey" FOREIGN KEY ("wbsWeekId") REFERENCES "WbsWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsWeekEntry" ADD CONSTRAINT "WbsWeekEntry_wbsTaskId_fkey" FOREIGN KEY ("wbsTaskId") REFERENCES "WbsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsWeekEntry" ADD CONSTRAINT "WbsWeekEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
