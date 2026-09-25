-- CreateTable
CREATE TABLE "TimelineRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',

    CONSTRAINT "TimelineRow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TimelineRow" ADD CONSTRAINT "TimelineRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

