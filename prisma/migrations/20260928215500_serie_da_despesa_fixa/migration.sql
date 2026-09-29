-- Série de uma despesa fixa ("Repetir todo mês"): as cópias dividem o mesmo id. Aditiva.
ALTER TABLE "MonthlyEntry" ADD COLUMN "recurrenceId" TEXT;

CREATE INDEX "MonthlyEntry_userId_recurrenceId_idx" ON "MonthlyEntry"("userId", "recurrenceId");
