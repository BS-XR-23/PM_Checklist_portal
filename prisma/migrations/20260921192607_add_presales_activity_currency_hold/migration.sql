CREATE TYPE "PresalesCurrency" AS ENUM ('USD', 'BDT');

ALTER TABLE "PresalesProject" ADD COLUMN "estimatedValueCurrency" "PresalesCurrency" NOT NULL DEFAULT 'USD';
ALTER TABLE "PresalesProject" ADD COLUMN "presaleFolderLink" TEXT;
ALTER TABLE "PresalesProject" ADD COLUMN "source" TEXT;
ALTER TABLE "PresalesProject" ADD COLUMN "onHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PresalesProject" ADD COLUMN "holdReason" TEXT;

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
