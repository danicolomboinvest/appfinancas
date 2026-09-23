-- Migração B dos perfis financeiros: os 11 índices únicos antigos, que valiam por usuário,
-- saem porque cada linha agora vive dentro de um perfil (o índice novo é por usuário+perfil e já
-- existe desde a migração aditiva de 21/09/2026). Só pode rodar DEPOIS do deploy do código que
-- usa os índices novos: o Prisma antigo fazia ON CONFLICT nestes aqui.

-- DropIndex
DROP INDEX "AccumulationProjectionCache_userId_year_key";

-- DropIndex
DROP INDEX "Budget_userId_year_month_parentCategory_customCategoryId_key";

-- DropIndex
DROP INDEX "CustomCategory_userId_name_key";

-- DropIndex
DROP INDEX "EmergencyFund_userId_key";

-- DropIndex
DROP INDEX "MonthlyEntry_userId_externalId_key";

-- DropIndex
DROP INDEX "MonthlyPlan_userId_year_month_key";

-- DropIndex
DROP INDEX "PatrimonySnapshot_userId_date_key";

-- DropIndex
DROP INDEX "PlanningParams_userId_key";

-- DropIndex
DROP INDEX "PortfolioStrategy_userId_assetClass_key";

-- DropIndex
DROP INDEX "TransactionCategoryRule_userId_pattern_key";

-- DropIndex
DROP INDEX "YearlyConsolidationCache_userId_year_key";
