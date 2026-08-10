-- AlterTable
ALTER TABLE "BudgetEntryRoleCost" ADD COLUMN     "personId" TEXT,
ADD COLUMN     "personName" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "roleRateId" TEXT;

-- AddForeignKey
ALTER TABLE "BudgetEntryRoleCost" ADD CONSTRAINT "BudgetEntryRoleCost_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_roleRateId_fkey" FOREIGN KEY ("roleRateId") REFERENCES "RoleRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
