-- CreateEnum
CREATE TYPE "ParentCategory" AS ENUM ('MORADIA', 'ALIMENTACAO', 'TRANSPORTE', 'SAUDE', 'LAZER', 'EDUCACAO', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "StrategyAssetClass" AS ENUM ('RENDA_FIXA_POS_FIXADA', 'RENDA_FIXA_IPCA', 'PREFIXADO', 'ACOES_BRASIL', 'FIIS', 'EXTERIOR', 'OUTROS');

-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "parentCategory" "ParentCategory";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "notifyBudgetAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLateGoals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark';

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "parentCategory" "ParentCategory" NOT NULL,
    "plannedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" "StrategyAssetClass" NOT NULL,
    "targetPercent" DECIMAL(6,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_year_month_parentCategory_key" ON "Budget"("userId", "year", "month", "parentCategory");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioStrategy_userId_assetClass_key" ON "PortfolioStrategy"("userId", "assetClass");

-- CreateIndex
CREATE INDEX "MonthlyEntry_userId_parentCategory_idx" ON "MonthlyEntry"("userId", "parentCategory");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioStrategy" ADD CONSTRAINT "PortfolioStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
