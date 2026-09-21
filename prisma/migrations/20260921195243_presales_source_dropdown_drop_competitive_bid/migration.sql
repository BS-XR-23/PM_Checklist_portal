CREATE TYPE "PresalesSource" AS ENUM ('INBOUND', 'OUTBOUND', 'REFERRAL', 'COMPETITIVE_TENDER', 'EXISTING_CLIENT');

-- Every existing row's "source" is already null (confirmed via a live
-- read-only query before writing this migration), so drop+recreate is safe
-- here rather than an in-place USING cast.
ALTER TABLE "PresalesProject" DROP COLUMN "source";
ALTER TABLE "PresalesProject" ADD COLUMN "source" "PresalesSource";

ALTER TABLE "PresalesProject" DROP COLUMN "competitiveBid";
