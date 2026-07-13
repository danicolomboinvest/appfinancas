-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "investedValue" DECIMAL(18,2);

-- Ativos existentes: começa com investido = valor atual (lucro zera a partir de hoje;
-- o usuário pode ajustar o valor investido real editando o ativo).
UPDATE "Asset" SET "investedValue" = "currentValue" WHERE "investedValue" IS NULL;
