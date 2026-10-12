-- "Dividir com alguém" na transação (versão nova): só colunas novas e opcionais.
ALTER TABLE "MonthlyEntry" ADD COLUMN "divididoCom" VARCHAR(40);
ALTER TABLE "MonthlyEntry" ADD COLUMN "parteDeOutro" DECIMAL(18,2);
ALTER TABLE "MonthlyEntry" ADD COLUMN "devolvidoEm" DATE;
