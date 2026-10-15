-- "Paguei" vira gasto (15/10/2026): aditiva. Nulo = lançamento sem conta das Recorrentes, como
-- sempre foi. A chave estrangeira usa SET NULL: apagar a conta nunca apaga o gasto.
ALTER TABLE "MonthlyEntry" ADD COLUMN "contaAPagarId" TEXT;
ALTER TABLE "MonthlyEntry" ADD COLUMN "origemDoPagamento" VARCHAR(60);
CREATE INDEX "MonthlyEntry_contaAPagarId_idx" ON "MonthlyEntry"("contaAPagarId");
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_contaAPagarId_fkey" FOREIGN KEY ("contaAPagarId") REFERENCES "ContaAPagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
