-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyMonthlyRecap" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recapEmailSentMonth" TEXT;
