-- CreateTable
CREATE TABLE "ResourceRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "allocation" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "backup" TEXT NOT NULL,

    CONSTRAINT "ResourceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "gate" TEXT NOT NULL,
    "requiredEvidence" TEXT NOT NULL,
    "exitCondition" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',

    CONSTRAINT "GateRow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ResourceRow" ADD CONSTRAINT "ResourceRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateRow" ADD CONSTRAINT "GateRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

