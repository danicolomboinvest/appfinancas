-- CreateTable
CREATE TABLE "PatrimonySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalValue" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrimonySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatrimonySnapshot_userId_date_idx" ON "PatrimonySnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PatrimonySnapshot_userId_date_key" ON "PatrimonySnapshot"("userId", "date");

-- AddForeignKey
ALTER TABLE "PatrimonySnapshot" ADD CONSTRAINT "PatrimonySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
