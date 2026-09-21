CREATE TYPE "PresalesForecastCategory" AS ENUM ('COMMIT', 'BEST_CASE', 'PIPELINE');

ALTER TABLE "PresalesProject" ADD COLUMN "pocDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PresalesProject" ADD COLUMN "forecastCategory" "PresalesForecastCategory";
ALTER TABLE "PresalesProject" ADD COLUMN "competitiveBid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PresalesProject" ADD COLUMN "practiceArea" TEXT;
ALTER TABLE "PresalesProject" ADD COLUMN "industry" TEXT;
ALTER TABLE "PresalesProject" ADD COLUMN "technology" TEXT;
