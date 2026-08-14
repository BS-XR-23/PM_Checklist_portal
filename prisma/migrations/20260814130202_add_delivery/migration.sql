-- AlterEnum
ALTER TYPE "ModuleName" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "competencyId" TEXT;

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsWeek" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WbsWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsTask" (
    "id" TEXT NOT NULL,
    "wbsWeekId" TEXT NOT NULL,
    "wbsNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "manDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualManDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "personId" TEXT,
    "personName" TEXT,
    "competencyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WbsTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competency_level_key" ON "Competency"("level");

-- CreateIndex
CREATE INDEX "WbsWeek_projectId_idx" ON "WbsWeek"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WbsWeek_projectId_weekEnding_key" ON "WbsWeek"("projectId", "weekEnding");

-- CreateIndex
CREATE INDEX "WbsTask_wbsWeekId_idx" ON "WbsTask"("wbsWeekId");

-- AddForeignKey
ALTER TABLE "WbsWeek" ADD CONSTRAINT "WbsWeek_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_wbsWeekId_fkey" FOREIGN KEY ("wbsWeekId") REFERENCES "WbsWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
