-- Dinheiro perdido (12/10/2026, versão B): os achados e a decisão da pessoa.
-- Aditiva: tabela nova, nada muda nas que existem.
CREATE TABLE "AchadoDinheiroPerdido" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "chave" VARCHAR(160) NOT NULL,
    "tipo" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "mensal" DECIMAL(18,2),
    "unico" DECIMAL(18,2),
    "dados" JSONB,
    "estado" VARCHAR(16) NOT NULL DEFAULT 'aberto',
    "decididoEm" TIMESTAMP(3),
    "estornoEm" TIMESTAMP(3),
    "vistoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchadoDinheiroPerdido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AchadoDinheiroPerdido_userId_profileId_chave_key" ON "AchadoDinheiroPerdido"("userId", "profileId", "chave");
CREATE INDEX "AchadoDinheiroPerdido_userId_profileId_estado_idx" ON "AchadoDinheiroPerdido"("userId", "profileId", "estado");

ALTER TABLE "AchadoDinheiroPerdido" ADD CONSTRAINT "AchadoDinheiroPerdido_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchadoDinheiroPerdido" ADD CONSTRAINT "AchadoDinheiroPerdido_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
