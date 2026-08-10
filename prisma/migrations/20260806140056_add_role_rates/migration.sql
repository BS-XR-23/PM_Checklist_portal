-- CreateTable
CREATE TABLE "RoleRate" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "manDayRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEntryRoleCost" (
    "id" TEXT NOT NULL,
    "budgetEntryId" TEXT NOT NULL,
    "roleRateId" TEXT,
    "roleName" TEXT NOT NULL,
    "manDayRate" DOUBLE PRECISION NOT NULL,
    "manDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetEntryRoleCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleRate_roleName_key" ON "RoleRate"("roleName");

-- CreateIndex
CREATE INDEX "BudgetEntryRoleCost_budgetEntryId_idx" ON "BudgetEntryRoleCost"("budgetEntryId");

-- AddForeignKey
ALTER TABLE "BudgetEntryRoleCost" ADD CONSTRAINT "BudgetEntryRoleCost_budgetEntryId_fkey" FOREIGN KEY ("budgetEntryId") REFERENCES "BudgetEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntryRoleCost" ADD CONSTRAINT "BudgetEntryRoleCost_roleRateId_fkey" FOREIGN KEY ("roleRateId") REFERENCES "RoleRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
