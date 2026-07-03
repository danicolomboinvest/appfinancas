-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "EntryCategory" AS ENUM ('INCOME', 'EXPENSE', 'INVESTMENT_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'BEHIND', 'ACHIEVED');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('RENDA_FIXA', 'ACAO', 'FII', 'TESOURO_DIRETO', 'FUNDO', 'CRIPTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "SimulationType" AS ENUM ('FINANCIAR_VS_ALUGAR', 'AMORTIZAR_VS_INVESTIR', 'CONSORCIO_VS_FINANCIAMENTO', 'MARCACAO_MERCADO', 'CARRO');

-- CreateEnum
CREATE TYPE "SheetType" AS ENUM ('STOCK', 'FII');

-- CreateEnum
CREATE TYPE "FiiType" AS ENUM ('TIJOLO', 'PAPEL', 'HIBRIDO', 'FUNDO_DE_FUNDOS');

-- CreateEnum
CREATE TYPE "RateBasis" AS ENUM ('ANNUAL_252', 'ANNUAL_365', 'MONTHLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorClientLink" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorClientLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "rateValue" DECIMAL(12,6) NOT NULL,
    "basis" "RateBasis" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "EntryCategory" NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "goalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearlyConsolidationCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalIncome" DECIMAL(18,2) NOT NULL,
    "totalExpense" DECIMAL(18,2) NOT NULL,
    "totalInvestment" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearlyConsolidationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "targetDate" TIMESTAMP(3),
    "currentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyContribution" DECIMAL(18,2),
    "annualRate" DECIMAL(12,6),
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyFund" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetMonths" INTEGER NOT NULL,
    "monthlyExpenseBase" DECIMAL(18,2) NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "currentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyContribution" DECIMAL(18,2) NOT NULL,
    "annualRate" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningParams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentAge" INTEGER NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "lifeExpectancyAge" INTEGER,
    "currentPatrimony" DECIMAL(18,2) NOT NULL,
    "monthlyContributionAccumulation" DECIMAL(18,2) NOT NULL,
    "accumulationAnnualRate" DECIMAL(12,6) NOT NULL,
    "inflationAnnualRate" DECIMAL(12,6) NOT NULL,
    "usufructAnnualRate" DECIMAL(12,6) NOT NULL,
    "desiredPassiveIncome" DECIMAL(18,2) NOT NULL,
    "otherPassiveIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccumulationProjectionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "age" INTEGER NOT NULL,
    "contributions" DECIMAL(18,2) NOT NULL,
    "interestEarned" DECIMAL(18,2) NOT NULL,
    "endingBalanceNom" DECIMAL(18,2) NOT NULL,
    "endingBalanceReal" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccumulationProjectionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "assetClass" "AssetClass" NOT NULL,
    "goalId" TEXT,
    "quantity" DECIMAL(18,6),
    "currentUnitPrice" DECIMAL(18,6),
    "currentValue" DECIMAL(18,2) NOT NULL,
    "idealAllocationPercent" DECIMAL(6,3),
    "acquisitionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SimulationType" NOT NULL,
    "name" TEXT,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisCriterionDefinition" (
    "id" TEXT NOT NULL,
    "sheetType" "SheetType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "category" TEXT,
    "weight" DECIMAL(6,3),
    "order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnalysisCriterionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sheetType" "SheetType" NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "fiiType" "FiiType",
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalScore" DECIMAL(8,2),
    "conclusion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResponse" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" TEXT,
    "score" DECIMAL(6,2),
    "note" TEXT,

    CONSTRAINT "AnalysisResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorClientLink_advisorId_clientId_key" ON "AdvisorClientLink"("advisorId", "clientId");

-- CreateIndex
CREATE INDEX "ReferenceRate_userId_idx" ON "ReferenceRate"("userId");

-- CreateIndex
CREATE INDEX "MonthlyEntry_userId_year_month_idx" ON "MonthlyEntry"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "YearlyConsolidationCache_userId_year_key" ON "YearlyConsolidationCache"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyFund_userId_key" ON "EmergencyFund"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningParams_userId_key" ON "PlanningParams"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccumulationProjectionCache_userId_year_key" ON "AccumulationProjectionCache"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCriterionDefinition_sheetType_key_key" ON "AnalysisCriterionDefinition"("sheetType", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResponse_sheetId_criterionId_key" ON "AnalysisResponse"("sheetId", "criterionId");

-- AddForeignKey
ALTER TABLE "AdvisorClientLink" ADD CONSTRAINT "AdvisorClientLink_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorClientLink" ADD CONSTRAINT "AdvisorClientLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRate" ADD CONSTRAINT "ReferenceRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyConsolidationCache" ADD CONSTRAINT "YearlyConsolidationCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyFund" ADD CONSTRAINT "EmergencyFund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParams" ADD CONSTRAINT "PlanningParams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccumulationProjectionCache" ADD CONSTRAINT "AccumulationProjectionCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSheet" ADD CONSTRAINT "AnalysisSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResponse" ADD CONSTRAINT "AnalysisResponse_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "AnalysisSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResponse" ADD CONSTRAINT "AnalysisResponse_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "AnalysisCriterionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
