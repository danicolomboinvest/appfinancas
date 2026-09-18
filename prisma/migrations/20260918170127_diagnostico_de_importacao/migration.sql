-- CreateTable
CREATE TABLE "ImportDiagnostic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "fileName" TEXT,
    "encoding" TEXT,
    "kind" TEXT,
    "institution" TEXT,
    "moneyLines" INTEGER NOT NULL DEFAULT 0,
    "parsed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "header" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportDiagnostic_createdAt_idx" ON "ImportDiagnostic"("createdAt");

-- CreateIndex
CREATE INDEX "ImportDiagnostic_ok_createdAt_idx" ON "ImportDiagnostic"("ok", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportDiagnostic" ADD CONSTRAINT "ImportDiagnostic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

