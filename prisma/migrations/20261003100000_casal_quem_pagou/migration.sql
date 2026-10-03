-- AlterTable
ALTER TABLE "FinancialProfile" ADD COLUMN     "casal" JSONB;

-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "doCasal" BOOLEAN,
ADD COLUMN     "pessoa" VARCHAR(1);

