-- AlterEnum
ALTER TYPE "AccessSource" ADD VALUE 'APPLE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenApple" TEXT;

-- CreateTable
CREATE TABLE "AssinaturaApple" (
    "originalTransactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ambiente" TEXT NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaApple_pkey" PRIMARY KEY ("originalTransactionId")
);

-- CreateIndex
CREATE INDEX "AssinaturaApple_userId_idx" ON "AssinaturaApple"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tokenApple_key" ON "User"("tokenApple");

-- AddForeignKey
ALTER TABLE "AssinaturaApple" ADD CONSTRAINT "AssinaturaApple_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

