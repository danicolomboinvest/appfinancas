-- AlterTable
ALTER TABLE "ContaAPagar" ADD COLUMN     "aproximado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intervalo" INTEGER,
ADD COLUMN     "mesesEscolhidos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "parcelaAtual" INTEGER,
ADD COLUMN     "parcelas" INTEGER,
ADD COLUMN     "unidade" VARCHAR(10),
ADD COLUMN     "valorEhTotal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ofertasDesligadas" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FechamentoDoMes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" VARCHAR(12) NOT NULL,
    "fechadoEm" TIMESTAMP(3),
    "reabertoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FechamentoDoMes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoDaConta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "dados" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoDaConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FechamentoDoMes_userId_idx" ON "FechamentoDoMes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoDoMes_profileId_ano_mes_key" ON "FechamentoDoMes"("profileId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "FotoDaConta_userId_key" ON "FotoDaConta"("userId");

-- AddForeignKey
ALTER TABLE "FechamentoDoMes" ADD CONSTRAINT "FechamentoDoMes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoDoMes" ADD CONSTRAINT "FechamentoDoMes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoDaConta" ADD CONSTRAINT "FotoDaConta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: o estado que já existia como marca em Decisao ("fechamento" / "fechamento_reaberto")
-- vira uma linha por perfil e mês, pela marca mais recente. Nada é apagado de Decisao.
INSERT INTO "FechamentoDoMes" ("id", "userId", "profileId", "ano", "mes", "estado", "fechadoEm", "reabertoEm", "createdAt", "updatedAt")
SELECT
  'fm_' || md5(d."profileId" || d."chave"),
  d."userId",
  d."profileId",
  CAST(substr(d."chave", 1, 4) AS INTEGER),
  CAST(substr(d."chave", 6, 2) AS INTEGER),
  CASE WHEN d."tipo" = 'fechamento' THEN 'fechado' ELSE 'reaberto' END,
  CASE WHEN d."tipo" = 'fechamento' THEN d."createdAt" ELSE NULL END,
  CASE WHEN d."tipo" = 'fechamento_reaberto' THEN d."createdAt" ELSE NULL END,
  d."createdAt",
  d."createdAt"
FROM (
  SELECT DISTINCT ON ("profileId", "chave") "userId", "profileId", "chave", "tipo", "createdAt"
  FROM "Decisao"
  WHERE "tipo" IN ('fechamento', 'fechamento_reaberto')
    AND "profileId" IS NOT NULL
    AND "chave" ~ '^[0-9]{4}-[0-9]{2}$'
  ORDER BY "profileId", "chave", "createdAt" DESC
) d
ON CONFLICT ("profileId", "ano", "mes") DO NOTHING;
