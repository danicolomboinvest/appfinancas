-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "exchangeRate" DECIMAL(14,6),
ADD COLUMN     "originalAmount" DECIMAL(18,2),
ADD COLUMN     "originalCurrency" VARCHAR(3);
