-- DropIndex
DROP INDEX "Budget_userId_year_month_parentCategory_key";

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "customCategoryId" TEXT,
ALTER COLUMN "parentCategory" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MonthlyEntry" ADD COLUMN     "customCategoryId" TEXT;

-- CreateTable
CREATE TABLE "CustomCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomCategory_userId_name_key" ON "CustomCategory"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_year_month_parentCategory_customCategoryId_key" ON "Budget"("userId", "year", "month", "parentCategory", "customCategoryId");

-- CreateIndex
CREATE INDEX "MonthlyEntry_userId_customCategoryId_idx" ON "MonthlyEntry"("userId", "customCategoryId");

-- AddForeignKey
ALTER TABLE "CustomCategory" ADD CONSTRAINT "CustomCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEntry" ADD CONSTRAINT "MonthlyEntry_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "CustomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "CustomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
