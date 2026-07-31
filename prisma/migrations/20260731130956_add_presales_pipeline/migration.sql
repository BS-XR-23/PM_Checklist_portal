-- CreateEnum
CREATE TYPE "PresalesOutcome" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "PresalesProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "description" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "expectedCloseDate" TIMESTAMP(3),
    "outcome" "PresalesOutcome" NOT NULL DEFAULT 'OPEN',
    "lostReason" TEXT,
    "wonProjectId" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresalesProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresalesDecisionItem" (
    "id" TEXT NOT NULL,
    "presalesProjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3),
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedBy" TEXT,
    "decidedByPersonId" TEXT,
    "notes" TEXT,

    CONSTRAINT "PresalesDecisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresalesActionItem" (
    "id" TEXT NOT NULL,
    "presalesProjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "ownerPersonId" TEXT,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "notes" TEXT,

    CONSTRAINT "PresalesActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresalesProject_wonProjectId_key" ON "PresalesProject"("wonProjectId");

-- CreateIndex
CREATE INDEX "PresalesProject_outcome_idx" ON "PresalesProject"("outcome");

-- CreateIndex
CREATE INDEX "PresalesDecisionItem_presalesProjectId_idx" ON "PresalesDecisionItem"("presalesProjectId");

-- CreateIndex
CREATE INDEX "PresalesActionItem_presalesProjectId_idx" ON "PresalesActionItem"("presalesProjectId");

-- AddForeignKey
ALTER TABLE "PresalesProject" ADD CONSTRAINT "PresalesProject_wonProjectId_fkey" FOREIGN KEY ("wonProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesProject" ADD CONSTRAINT "PresalesProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesDecisionItem" ADD CONSTRAINT "PresalesDecisionItem_presalesProjectId_fkey" FOREIGN KEY ("presalesProjectId") REFERENCES "PresalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesDecisionItem" ADD CONSTRAINT "PresalesDecisionItem_decidedByPersonId_fkey" FOREIGN KEY ("decidedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesActionItem" ADD CONSTRAINT "PresalesActionItem_presalesProjectId_fkey" FOREIGN KEY ("presalesProjectId") REFERENCES "PresalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesActionItem" ADD CONSTRAINT "PresalesActionItem_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
