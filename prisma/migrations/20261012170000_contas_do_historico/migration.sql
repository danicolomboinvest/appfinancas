-- Contas do histórico (12/10/2026): o app acha as contas recorrentes no extrato e cadastra sozinho.
-- Aditiva: colunas novas opcionais em ContaAPagar e uma tabela nova para a recusa.
ALTER TABLE "ContaAPagar" ADD COLUMN "origem" VARCHAR(12);
ALTER TABLE "ContaAPagar" ADD COLUMN "chaveDoHistorico" VARCHAR(160);
ALTER TABLE "ContaAPagar" ADD COLUMN "categoria" "ParentCategory";
ALTER TABLE "ContaAPagar" ADD COLUMN "editadaPelaPessoa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContaAPagar" ADD COLUMN "avisadaEm" TIMESTAMP(3);

CREATE TABLE "ContaRecusada" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "chave" VARCHAR(160) NOT NULL,
    "nome" VARCHAR(80),
    "valor" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaRecusada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContaRecusada_userId_profileId_chave_key" ON "ContaRecusada"("userId", "profileId", "chave");

ALTER TABLE "ContaRecusada" ADD CONSTRAINT "ContaRecusada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaRecusada" ADD CONSTRAINT "ContaRecusada_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
