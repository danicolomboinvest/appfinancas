import type { SheetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CriterionInput = {
  sheetType: SheetType;
  key: string;
  label: string;
  category: string;
  helpText?: string;
  order: number;
};

export async function listAllCriteria(sheetType?: SheetType) {
  return prisma.analysisCriterionDefinition.findMany({
    where: sheetType ? { sheetType } : undefined,
    orderBy: [{ sheetType: "asc" }, { category: "asc" }, { order: "asc" }],
  });
}

export async function createCriterion(input: CriterionInput) {
  return prisma.analysisCriterionDefinition.create({ data: input });
}

export async function updateCriterion(id: string, input: CriterionInput) {
  return prisma.analysisCriterionDefinition.update({ where: { id }, data: input });
}

export async function setCriterionActive(id: string, active: boolean) {
  return prisma.analysisCriterionDefinition.update({ where: { id }, data: { active } });
}
