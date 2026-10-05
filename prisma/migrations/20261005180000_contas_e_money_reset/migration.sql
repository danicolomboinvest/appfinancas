-- AlterTable
ALTER TABLE "AllowedProduct" ADD COLUMN     "concede" TEXT NOT NULL DEFAULT 'app';

-- CreateTable
CREATE TABLE "ProdutoLiberado" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "produto" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'hubla',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoLiberado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaAPagar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "nome" VARCHAR(80) NOT NULL,
    "valor" DECIMAL(18,2),
    "vencimento" DATE NOT NULL,
    "repete" BOOLEAN NOT NULL DEFAULT false,
    "lembrar" BOOLEAN NOT NULL DEFAULT true,
    "pagaEm" TIMESTAMP(3),
    "quitada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaAPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoLiberado_email_produto_key" ON "ProdutoLiberado"("email", "produto");

-- CreateIndex
CREATE INDEX "ContaAPagar_userId_profileId_vencimento_idx" ON "ContaAPagar"("userId", "profileId", "vencimento");

-- AddForeignKey
ALTER TABLE "ContaAPagar" ADD CONSTRAINT "ContaAPagar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaAPagar" ADD CONSTRAINT "ContaAPagar_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

