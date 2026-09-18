-- CreateTable
CREATE TABLE "AppError" (
    "id" TEXT NOT NULL,
    "routePath" TEXT,
    "routeType" TEXT,
    "method" TEXT,
    "message" TEXT NOT NULL,
    "digest" TEXT,
    "stack" TEXT,
    "vezes" INTEGER NOT NULL DEFAULT 1,
    "primeiroEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppError_ultimoEm_idx" ON "AppError"("ultimoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AppError_routePath_message_key" ON "AppError"("routePath", "message");

