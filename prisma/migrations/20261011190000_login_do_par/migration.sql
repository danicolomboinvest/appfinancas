-- Login do par no perfil Casal (11/10/2026). Só ACRESCENTA: duas colunas novas em MonthlyEntry
-- (com padrão, nada muda no que já existe) e quatro tabelas novas. Nenhum dado é reescrito.
-- NÃO aplicar em produção sem a dona revisar.

-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "autorUserId" TEXT,
ADD COLUMN     "soMeu" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConviteCasal" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nomePar" VARCHAR(30) NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "canal" VARCHAR(12),
    "status" VARCHAR(12) NOT NULL DEFAULT 'aberto',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "aceitoEm" TIMESTAMP(3),
    "aceitoPorId" TEXT,
    "encerradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConviteCasal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroCasal" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saiuEm" TIMESTAMP(3),
    "motivoSaida" VARCHAR(20),
    "bloqueadoEm" TIMESTAMP(3),
    "emUso" BOOLEAN NOT NULL DEFAULT true,
    "termosVersao" VARCHAR(20) NOT NULL,
    "termosAceitosEm" TIMESTAMP(3) NOT NULL,
    "conviteId" TEXT,

    CONSTRAINT "MembroCasal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechamentoCasal" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "confereA" TIMESTAMP(3),
    "confereB" TIMESTAMP(3),
    "assinaturaA" VARCHAR(64),
    "assinaturaB" VARCHAR(64),
    "fechadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FechamentoCasal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaDoConvite" (
    "id" TEXT NOT NULL,
    "chave" VARCHAR(64) NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaDoConvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConviteCasal_tokenHash_key" ON "ConviteCasal"("tokenHash");

-- CreateIndex
CREATE INDEX "ConviteCasal_profileId_status_idx" ON "ConviteCasal"("profileId", "status");

-- CreateIndex
CREATE INDEX "MembroCasal_userId_idx" ON "MembroCasal"("userId");

-- CreateIndex
CREATE INDEX "MembroCasal_profileId_idx" ON "MembroCasal"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoCasal_profileId_ano_mes_key" ON "FechamentoCasal"("profileId", "ano", "mes");

-- CreateIndex
CREATE INDEX "TentativaDoConvite_chave_em_idx" ON "TentativaDoConvite"("chave", "em");

-- AddForeignKey
ALTER TABLE "ConviteCasal" ADD CONSTRAINT "ConviteCasal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteCasal" ADD CONSTRAINT "ConviteCasal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroCasal" ADD CONSTRAINT "MembroCasal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroCasal" ADD CONSTRAINT "MembroCasal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoCasal" ADD CONSTRAINT "FechamentoCasal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras que o Prisma não escreve no schema (índices parciais): garantem no banco, mesmo com
-- dois cliques ao mesmo tempo, um convite aberto por perfil, um par ativo por perfil e um
-- Nós dois ativo por pessoa.
CREATE UNIQUE INDEX "ConviteCasal_um_aberto_por_perfil" ON "ConviteCasal"("profileId") WHERE "status" = 'aberto';
CREATE UNIQUE INDEX "MembroCasal_um_par_ativo_por_perfil" ON "MembroCasal"("profileId") WHERE "saiuEm" IS NULL;
CREATE UNIQUE INDEX "MembroCasal_um_casal_ativo_por_pessoa" ON "MembroCasal"("userId") WHERE "saiuEm" IS NULL;
