-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ritmoAcompanhamento" TEXT;

-- CreateTable
CREATE TABLE "Decisao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "tipo" TEXT NOT NULL,
    "chave" TEXT,
    "valor" DECIMAL(18,2),
    "descricao" TEXT,
    "dados" JSONB,
    "resolvidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decisao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Decisao_userId_profileId_tipo_idx" ON "Decisao"("userId", "profileId", "tipo");

-- CreateIndex
CREATE INDEX "Decisao_userId_createdAt_idx" ON "Decisao"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Decisao" ADD CONSTRAINT "Decisao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decisao" ADD CONSTRAINT "Decisao_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

