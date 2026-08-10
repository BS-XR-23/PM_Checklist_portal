-- CreateTable
CREATE TABLE "ProjectEngagementMonth" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "intensityPct" INTEGER NOT NULL,

    CONSTRAINT "ProjectEngagementMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectEngagementMonth_engagementId_idx" ON "ProjectEngagementMonth"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEngagementMonth_engagementId_month_key" ON "ProjectEngagementMonth"("engagementId", "month");

-- AddForeignKey
ALTER TABLE "ProjectEngagementMonth" ADD CONSTRAINT "ProjectEngagementMonth_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "ProjectEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
