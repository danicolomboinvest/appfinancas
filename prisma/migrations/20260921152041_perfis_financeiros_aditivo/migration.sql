-- Perfis financeiros: a coluna entra VAZIA em todas as tabelas de dinheiro.
--
-- Nada é removido aqui de propósito. Os 11 índices únicos antigos continuam de pé e só caem
-- numa segunda migração, DEPOIS do deploy: o Prisma usa ON CONFLICT neles, então derrubá-los
-- enquanto o código antigo está no ar quebraria a Reserva de Emergência e o Planejamento de
-- quem estiver usando naquele minuto.
--
-- Os índices novos convivem com os velhos sem conflito: profileId nasce NULL, e no Postgres
-- NULLs são distintos entre si num índice único.
-- CreateEnum
CREATE TYPE "ProfileKind" AS ENUM ('PESSOAL', 'EMPRESA', 'CASAL', 'CASA', 'PROJETO', 'OUTRO');

-- AlterTable
ALTER TABLE "AccumulationProjectionCache" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "AnalysisSheet" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "ContributionAllocation" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "CustomCategory" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "EmergencyFund" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "MonthlyPlan" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "PatrimonySnapshot" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "PlanningParams" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "PortfolioStrategy" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "TransactionCategoryRule" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "YearlyConsolidationCache" ADD COLUMN     "profileId" TEXT;

-- CreateTable
CREATE TABLE "FinancialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProfileKind" NOT NULL DEFAULT 'PESSOAL',
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "color" TEXT NOT NULL DEFAULT 'ambar',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialProfile_userId_position_idx" ON "FinancialProfile"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AccumulationProjectionCache_userId_profileId_year_key" ON "AccumulationProjectionCache"("userId", "profileId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_profileId_year_month_parentCategory_customCat_key" ON "Budget"("userId", "profileId", "year", "month", "parentCategory", "customCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCategory_userId_profileId_name_key" ON "CustomCategory"("userId", "profileId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyFund_profileId_key" ON "EmergencyFund"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEntry_userId_profileId_externalId_key" ON "MonthlyEntry"("userId", "profileId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPlan_userId_profileId_year_month_key" ON "MonthlyPlan"("userId", "profileId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PatrimonySnapshot_userId_profileId_date_key" ON "PatrimonySnapshot"("userId", "profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningParams_profileId_key" ON "PlanningParams"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioStrategy_userId_profileId_assetClass_key" ON "PortfolioStrategy"("userId", "profileId", "assetClass");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategoryRule_userId_profileId_pattern_key" ON "TransactionCategoryRule"("userId", "profileId", "pattern");

-- CreateIndex
CREATE UNIQUE INDEX "YearlyConsolidationCache_userId_profileId_year_key" ON "YearlyConsolidationCache"("userId", "profileId", "year");

-- AddForeignKey
ALTER TABLE "FinancialProfile" ADD CONSTRAINT "FinancialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCategoryRule" ADD CONSTRAINT "TransactionCategoryRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCategory" ADD CONSTRAINT "CustomCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPlan" ADD CONSTRAINT "MonthlyPlan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyConsolidationCache" ADD CONSTRAINT "YearlyConsolidationCache_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyFund" ADD CONSTRAINT "EmergencyFund_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParams" ADD CONSTRAINT "PlanningParams_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccumulationProjectionCache" ADD CONSTRAINT "AccumulationProjectionCache_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioStrategy" ADD CONSTRAINT "PortfolioStrategy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrimonySnapshot" ADD CONSTRAINT "PatrimonySnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSheet" ADD CONSTRAINT "AnalysisSheet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
