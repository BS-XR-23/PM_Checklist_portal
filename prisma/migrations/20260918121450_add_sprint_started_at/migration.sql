-- Add the new lifecycle column, nullable (Draft = null).
ALTER TABLE "Sprint" ADD COLUMN "startedAt" TIMESTAMP(3);

-- Backfill: every sprint that already exists (open or closed) must read as
-- already-started, so existing data's PV/EV/AV/departure-tracking behavior
-- does not change. startDate is NOT NULL and is the PM's own real start
-- date, making it the natural backfill value.
UPDATE "Sprint" SET "startedAt" = "startDate" WHERE "startedAt" IS NULL;
