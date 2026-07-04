/*
  Warnings:

  - Made the column `category` on table `AnalysisCriterionDefinition` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AnalysisCriterionDefinition" ALTER COLUMN "category" SET NOT NULL;
