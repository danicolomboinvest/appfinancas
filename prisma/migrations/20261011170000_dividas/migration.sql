-- Área Dívidas (11/10/2026): as dívidas que a pessoa cadastra.
-- Aditiva: tabela nova, nada muda nas que existem.
CREATE TABLE "Divida" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "tipo" VARCHAR(32) NOT NULL,
    "credor" VARCHAR(40) NOT NULL,
    "apelido" VARCHAR(40) NOT NULL DEFAULT '',
    "paraQue" VARCHAR(40),
    "planejada" BOOLEAN NOT NULL DEFAULT false,
    "saldo" DECIMAL(18,2) NOT NULL,
    "porMes" DECIMAL(18,2) NOT NULL,
    "parcelasAbertas" INTEGER,
    "parcelasTotal" INTEGER,
    "semParcela" BOOLEAN NOT NULL DEFAULT false,
    "taxaMensal" DECIMAL(8,4),
    "diaVencimento" INTEGER,
    "atrasada" BOOLEAN NOT NULL DEFAULT false,
    "quitadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Divida_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Divida_userId_profileId_idx" ON "Divida"("userId", "profileId");

ALTER TABLE "Divida" ADD CONSTRAINT "Divida_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Divida" ADD CONSTRAINT "Divida_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
