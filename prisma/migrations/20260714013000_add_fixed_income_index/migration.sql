-- CreateEnum
CREATE TYPE "FixedIncomeIndex" AS ENUM ('POS_FIXADO', 'IPCA', 'PREFIXADO');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "fixedIncomeIndex" "FixedIncomeIndex";
