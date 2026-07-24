-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "contractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedManDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "itemText" TEXT NOT NULL,
    "milestoneName" TEXT,
    "owner" TEXT,
    "plannedDate" TIMESTAMP(3),
    "forecastDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestonePayment" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "paymentPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoiceStatus" TEXT NOT NULL DEFAULT 'Not Invoiced',
    "clientSignoff" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,

    CONSTRAINT "MilestonePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Risk',
    "category" TEXT,
    "description" TEXT NOT NULL,
    "probability" TEXT NOT NULL DEFAULT 'Medium',
    "impact" TEXT NOT NULL DEFAULT 'Medium',
    "owner" TEXT,
    "mitigation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dateRaised" TIMESTAMP(3),
    "dateClosed" TIMESTAMP(3),
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RiskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dateRaised" TIMESTAMP(3),
    "description" TEXT,
    "manDaysPlanned" DOUBLE PRECISION,
    "billableManDays" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'Paid',
    "clientSignoff" TEXT NOT NULL DEFAULT 'Pending',
    "wbsUpdated" TEXT NOT NULL DEFAULT 'No',
    "status" TEXT NOT NULL DEFAULT 'Proposed',
    "notes" TEXT,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "pctPlannedComplete" DOUBLE PRECISION NOT NULL,
    "pctActualComplete" DOUBLE PRECISION NOT NULL,
    "actualCost" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "preparedBy" TEXT,
    "planDate" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0',
    "rationale" TEXT,
    "charterObjective" TEXT,
    "charterScopeIn" TEXT,
    "charterScopeOut" TEXT,
    "charterSuccessCriteria" TEXT,
    "charterTimeline" TEXT,
    "charterBudget" TEXT,
    "charterAssumptions" TEXT,
    "charterPmAuthority" TEXT,
    "methodApproach" TEXT,
    "methodCadence" TEXT,
    "methodCeremonies" TEXT,
    "methodTools" TEXT,
    "methodRoles" TEXT,
    "methodChangeMgmt" TEXT,
    "testLevels" TEXT,
    "testEnvironments" TEXT,
    "testEntryCriteria" TEXT,
    "testExitCriteria" TEXT,
    "testDefectMgmt" TEXT,
    "testUatProcess" TEXT,
    "testDeliverables" TEXT,
    "deployEnvironments" TEXT,
    "deployReleaseStrategy" TEXT,
    "deploySteps" TEXT,
    "deployRollback" TEXT,
    "deployGoliveChecklist" TEXT,
    "deployMonitoring" TEXT,
    "escalationPath" TEXT,

    CONSTRAINT "PMPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakeholderRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stakeholder" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "accessRequired" TEXT NOT NULL,

    CONSTRAINT "StakeholderRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommsRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "audience" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "CommsRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciRow" (
    "id" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "pm" TEXT NOT NULL,
    "tl" TEXT NOT NULL,
    "ba" TEXT NOT NULL,
    "leadEng" TEXT NOT NULL,
    "creativeLead" TEXT NOT NULL,

    CONSTRAINT "RaciRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_projectId_type_order_key" ON "ChecklistItem"("projectId", "type", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MilestonePayment_checklistItemId_key" ON "MilestonePayment"("checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_projectId_crCode_key" ON "ChangeRequest"("projectId", "crCode");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEntry_projectId_weekEnding_key" ON "BudgetEntry"("projectId", "weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "PMPlan_projectId_key" ON "PMPlan"("projectId");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestonePayment" ADD CONSTRAINT "MilestonePayment_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskItem" ADD CONSTRAINT "RiskItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntry" ADD CONSTRAINT "BudgetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMPlan" ADD CONSTRAINT "PMPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakeholderRow" ADD CONSTRAINT "StakeholderRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommsRow" ADD CONSTRAINT "CommsRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciRow" ADD CONSTRAINT "RaciRow_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PMPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
