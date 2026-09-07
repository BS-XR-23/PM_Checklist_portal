-- CreateTable
CREATE TABLE "PmPlanLink" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "PmPlanLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PmPlanLink_pmPlanId_field_key" ON "PmPlanLink"("pmPlanId", "field");

-- AddForeignKey
ALTER TABLE "PmPlanLink" ADD CONSTRAINT "PmPlanLink_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
