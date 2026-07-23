-- CreateTable
CREATE TABLE "AllowedProduct" (
    "id" TEXT NOT NULL,
    "hublaProductId" TEXT,
    "name" TEXT NOT NULL,
    "source" "AccessSource" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedProduct_hublaProductId_key" ON "AllowedProduct"("hublaProductId");
