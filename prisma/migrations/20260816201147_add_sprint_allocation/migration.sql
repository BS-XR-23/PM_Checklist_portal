-- CreateTable
CREATE TABLE "SprintAllocation" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "allocationPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "jiraHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SprintAllocation_sprintId_idx" ON "SprintAllocation"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintAllocation_sprintId_personId_key" ON "SprintAllocation"("sprintId", "personId");

-- AddForeignKey
ALTER TABLE "SprintAllocation" ADD CONSTRAINT "SprintAllocation_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintAllocation" ADD CONSTRAINT "SprintAllocation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
