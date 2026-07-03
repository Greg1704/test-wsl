-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "limitRate" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trackCreditLimits" BOOLEAN NOT NULL DEFAULT false;
