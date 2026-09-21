CREATE TYPE "PresalesStage" AS ENUM ('LEAD', 'QUALIFYING', 'PROPOSAL', 'NEGOTIATION');

-- DEFAULT 'QUALIFYING' backfills every existing row (including the 18
-- currently-OPEN opportunities) in this one statement, and becomes the
-- ongoing default for future opportunities. PMs re-triage the 18 manually
-- afterward via the board's stage dropdown — not automated.
ALTER TABLE "PresalesProject" ADD COLUMN "stage" "PresalesStage" NOT NULL DEFAULT 'QUALIFYING';

ALTER TABLE "PresalesProject" ADD COLUMN "dealOwnerPersonId" TEXT;
ALTER TABLE "PresalesProject" ADD CONSTRAINT "PresalesProject_dealOwnerPersonId_fkey"
  FOREIGN KEY ("dealOwnerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PresalesProject_stage_idx" ON "PresalesProject"("stage");
