-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "uatFeedback" TEXT,
ADD COLUMN     "uatSignoffDate" TIMESTAMP(3),
ADD COLUMN     "uatSignoffStatus" TEXT NOT NULL DEFAULT 'Pending';

