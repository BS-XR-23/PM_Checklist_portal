-- AlterTable
ALTER TABLE "WbsTask" ADD COLUMN     "sprintId" TEXT,
ADD COLUMN     "storyPoints" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "frozenPlannedManDays" DOUBLE PRECISION,
    "frozenEarnedManDays" DOUBLE PRECISION,
    "frozenActualValue" DOUBLE PRECISION,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");

-- CreateIndex
CREATE INDEX "WbsTask_sprintId_idx" ON "WbsTask"("sprintId");

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
