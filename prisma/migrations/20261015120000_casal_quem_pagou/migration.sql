-- Casal simples (15/10/2026, versão A): de quem é o gasto (o do par), quem pagou e a divisão
-- própria de cada lançamento. Só acrescenta colunas; o que existe fica como está.
ALTER TABLE "MonthlyEntry" ADD COLUMN "doPar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MonthlyEntry" ADD COLUMN "pagouOPar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MonthlyEntry" ADD COLUMN "divisaoPropria" VARCHAR(6);
ALTER TABLE "MonthlyEntry" ADD COLUMN "parteDeQuemLancou" DECIMAL(5,2);
