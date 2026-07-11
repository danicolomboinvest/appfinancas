import { PrismaClient, type RateBasis } from "@prisma/client";
import { STOCK_CRITERIA, FII_CRITERIA, STOCK_INTL_CRITERIA, ETF_CRITERIA, type CriterionSeed } from "./criteria-catalog";

const prisma = new PrismaClient();

const DEFAULT_RATES: { id: string; name: string; rateValue: number; basis: RateBasis }[] = [
  { id: "seed-cdi", name: "CDI", rateValue: 0.1065, basis: "ANNUAL_252" },
  { id: "seed-ipca", name: "IPCA", rateValue: 0.045, basis: "ANNUAL_365" },
  { id: "seed-selic", name: "Selic", rateValue: 0.1075, basis: "ANNUAL_252" },
];

async function seedCriteria(sheetType: "STOCK" | "FII" | "STOCK_INTL" | "ETF", criteria: CriterionSeed[]) {
  for (const criterion of criteria) {
    await prisma.analysisCriterionDefinition.upsert({
      where: { sheetType_key: { sheetType, key: criterion.key } },
      update: {
        label: criterion.label,
        category: criterion.category,
        helpText: criterion.helpText,
        order: criterion.order,
      },
      create: { sheetType, ...criterion },
    });
  }
}

async function main() {
  const effectiveDate = new Date();

  for (const rate of DEFAULT_RATES) {
    await prisma.referenceRate.upsert({
      where: { id: rate.id },
      update: { rateValue: rate.rateValue, basis: rate.basis, effectiveDate },
      create: { ...rate, userId: null, effectiveDate },
    });
  }

  await seedCriteria("STOCK", STOCK_CRITERIA);
  await seedCriteria("FII", FII_CRITERIA);
  await seedCriteria("STOCK_INTL", STOCK_INTL_CRITERIA);
  await seedCriteria("ETF", ETF_CRITERIA);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
