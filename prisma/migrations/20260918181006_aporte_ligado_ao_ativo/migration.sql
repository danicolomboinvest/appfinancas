-- CreateTable
CREATE TABLE "ContributionAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionAllocation_userId_createdAt_idx" ON "ContributionAllocation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContributionAllocation_entryId_idx" ON "ContributionAllocation"("entryId");

-- CreateIndex
CREATE INDEX "ContributionAllocation_assetId_idx" ON "ContributionAllocation"("assetId");

-- AddForeignKey
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MonthlyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

