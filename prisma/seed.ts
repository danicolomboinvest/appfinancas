import { PrismaClient, type RateBasis } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_RATES: { id: string; name: string; rateValue: number; basis: RateBasis }[] = [
  { id: "seed-cdi", name: "CDI", rateValue: 0.1065, basis: "ANNUAL_252" },
  { id: "seed-ipca", name: "IPCA", rateValue: 0.045, basis: "ANNUAL_365" },
  { id: "seed-selic", name: "Selic", rateValue: 0.1075, basis: "ANNUAL_252" },
];

async function main() {
  const effectiveDate = new Date();

  for (const rate of DEFAULT_RATES) {
    await prisma.referenceRate.upsert({
      where: { id: rate.id },
      update: { rateValue: rate.rateValue, basis: rate.basis, effectiveDate },
      create: { ...rate, userId: null, effectiveDate },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
