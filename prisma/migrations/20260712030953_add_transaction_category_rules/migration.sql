-- CreateTable
CREATE TABLE "TransactionCategoryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "parentCategory" "ParentCategory" NOT NULL,
    "subcategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionCategoryRule_userId_idx" ON "TransactionCategoryRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategoryRule_userId_pattern_key" ON "TransactionCategoryRule"("userId", "pattern");

-- AddForeignKey
ALTER TABLE "TransactionCategoryRule" ADD CONSTRAINT "TransactionCategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
