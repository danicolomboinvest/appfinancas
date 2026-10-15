-- Cartão com fechamento e vencimento (15/10/2026): aditiva. Tabela nova e uma coluna opcional
-- nos lançamentos; nada do que existe muda.
CREATE TABLE "Cartao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "banco" VARCHAR(24) NOT NULL,
    "apelido" VARCHAR(40),
    "diaFechamento" INTEGER,
    "diaVencimento" INTEGER,
    "final" VARCHAR(4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cartao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Cartao_userId_profileId_idx" ON "Cartao"("userId", "profileId");

ALTER TABLE "Cartao" ADD CONSTRAINT "Cartao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cartao" ADD CONSTRAINT "Cartao_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyEntry" ADD COLUMN "cartaoId" TEXT;
CREATE INDEX "MonthlyEntry_cartaoId_idx" ON "MonthlyEntry"("cartaoId");
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "Cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
