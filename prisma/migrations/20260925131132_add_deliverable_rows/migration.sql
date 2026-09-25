-- CreateTable
CREATE TABLE "DeliverableRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "deliverable" TEXT NOT NULL,
    "acceptanceEvidence" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "target" TEXT NOT NULL,

    CONSTRAINT "DeliverableRow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DeliverableRow" ADD CONSTRAINT "DeliverableRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

