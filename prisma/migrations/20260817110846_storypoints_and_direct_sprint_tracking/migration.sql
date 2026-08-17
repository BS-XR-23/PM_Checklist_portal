/*
  Warnings:

  - You are about to drop the column `frozenEarnedManDays` on the `Sprint` table. All the data in the column will be lost.
  - You are about to drop the column `frozenPlannedManDays` on the `Sprint` table. All the data in the column will be lost.
  - You are about to drop the column `manDays` on the `WbsTask` table. All the data in the column will be lost.
  - You are about to drop the `WbsWeek` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WbsWeekEntry` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `storyPoints` on table `WbsTask` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "WbsWeek" DROP CONSTRAINT "WbsWeek_projectId_fkey";

-- DropForeignKey
ALTER TABLE "WbsWeekEntry" DROP CONSTRAINT "WbsWeekEntry_personId_fkey";

-- DropForeignKey
ALTER TABLE "WbsWeekEntry" DROP CONSTRAINT "WbsWeekEntry_wbsTaskId_fkey";

-- DropForeignKey
ALTER TABLE "WbsWeekEntry" DROP CONSTRAINT "WbsWeekEntry_wbsWeekId_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "plannedStoryPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sprint" DROP COLUMN "frozenEarnedManDays",
DROP COLUMN "frozenPlannedManDays",
ADD COLUMN     "frozenEarnedPoints" DOUBLE PRECISION,
ADD COLUMN     "frozenPlannedPoints" DOUBLE PRECISION,
ADD COLUMN     "frozenTaskSnapshot" JSONB;

-- AlterTable
ALTER TABLE "WbsTask" DROP COLUMN "manDays",
ADD COLUMN     "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "competencyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "storyPoints" SET NOT NULL,
ALTER COLUMN "storyPoints" SET DEFAULT 0;

-- DropTable
DROP TABLE "WbsWeek";

-- DropTable
DROP TABLE "WbsWeekEntry";
