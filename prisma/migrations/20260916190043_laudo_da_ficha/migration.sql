-- AlterTable
ALTER TABLE "AnalysisSheet" ADD COLUMN     "autoScore" DECIMAL(4,2),
ADD COLUMN     "laudo" JSONB,
ADD COLUMN     "laudoReadAt" TIMESTAMP(3);
