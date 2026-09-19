-- CreateTable
CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diagnosticId" TEXT,
    "fileName" TEXT,
    "encoding" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "ImportFile_diagnosticId_key" ON "ImportFile"("diagnosticId");
-- CreateIndex
CREATE INDEX "ImportFile_createdAt_idx" ON "ImportFile"("createdAt");
-- CreateIndex
CREATE INDEX "ImportFile_expiresAt_idx" ON "ImportFile"("expiresAt");
-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "ImportDiagnostic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
