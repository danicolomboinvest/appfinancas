-- Compra parcelada lançada à mão (18/10/2026): aditiva. Uma coluna opcional nos lançamentos que
-- liga as parcelas da mesma compra, e o índice para achá-las. Nada do que existe muda.
ALTER TABLE "MonthlyEntry" ADD COLUMN "parcelamentoId" VARCHAR(40);
CREATE INDEX "MonthlyEntry_userId_parcelamentoId_idx" ON "MonthlyEntry"("userId", "parcelamentoId");
