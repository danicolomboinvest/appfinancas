/**
 * As contas da jornada (só no banco local spi_jornada_teste, chamado por preparar.ts):
 *  - Ana (ana@exemplo.test): a Ana canônica de scripts/semear-local.ts, com o Ateliê (Empresa).
 *  - Clara (clara@exemplo.test): só a compra liberada (AllowedEmail). A conta ela cria na jornada.
 *  - Bia (bia@exemplo.test): titular do Casal, com um mês de lançamentos; o par (Caio) entra pelo
 *    convite durante a jornada.
 * Nenhum dado de cliente real. Senha de teste igual à do semear-local.
 */
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient, type ParentCategory } from "@prisma/client";
import { SENHA } from "./config";

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@nada/x").hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Recusei: só no banco local (veio "${host}").`);
  process.exit(1);
}
const prisma = new PrismaClient();

async function main() {
  // Ana e o Ateliê (os scripts de sempre, mesmos números das fotos).
  execFileSync("npx", ["tsx", "scripts/semear-local.ts"], { stdio: "inherit", env: process.env });
  execFileSync("npx", ["tsx", "scripts/semear-empresa-local.ts"], { stdio: "inherit", env: process.env });
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana@exemplo.test" } });
  // O Pessoal volta a ser o perfil que abre (o semear da Empresa deixa a Empresa ativa).
  await prisma.financialProfile.updateMany({ where: { userId: ana.id }, data: { isDefault: false } });
  await prisma.financialProfile.updateMany({ where: { userId: ana.id, kind: "PESSOAL" }, data: { isDefault: true } });
  // Ela já viu o tutorial da versão nova.
  await prisma.user.update({ where: { id: ana.id }, data: { novidadesVersaoNova: "pulou", novidadesVistasEm: new Date() } });

  // Clara: comprou hoje pela Hubla, ainda sem conta.
  await prisma.allowedEmail.upsert({ where: { email: "clara@exemplo.test" }, update: { active: true }, create: { email: "clara@exemplo.test", note: "jornada: conta nova", source: "HUBLA" } });

  // Bia: titular do Casal. Pessoal + Casal, um mês de setembro e o começo de outubro no Casal.
  await prisma.allowedEmail.upsert({ where: { email: "bia@exemplo.test" }, update: { active: true }, create: { email: "bia@exemplo.test", note: "jornada: casal", source: "HUBLA" } });
  const bia = await prisma.user.create({
    data: { email: "bia@exemplo.test", name: "Bia Rocha", passwordHash: await bcrypt.hash(SENHA, 10), emailVerifiedAt: new Date(), onboardedAt: new Date(), theme: "light", novidadesVersaoNova: "pulou", novidadesVistasEm: new Date() },
  });
  const pessoal = await prisma.financialProfile.create({ data: { userId: bia.id, name: "Pessoal", kind: "PESSOAL", theme: "girly", isDefault: true } });
  const dono = { userId: bia.id, profileId: pessoal.id };
  let n = 0;
  const g = (year: number, month: number, dia: number, parentCategory: ParentCategory, description: string, amount: number) => ({
    ...dono, year, month, category: "EXPENSE" as const, parentCategory, description, amount, externalId: `jornada:bia:${n++}`, entryDate: new Date(Date.UTC(year, month - 1, dia)),
  });
  await prisma.monthlyEntry.createMany({
    data: [
      { ...dono, year: 2026, month: 9, category: "INCOME", description: "Salário", amount: 5200, externalId: "jornada:bia:s9", entryDate: new Date(Date.UTC(2026, 8, 5)) },
      { ...dono, year: 2026, month: 10, category: "INCOME", description: "Salário", amount: 5200, externalId: "jornada:bia:s10", entryDate: new Date(Date.UTC(2026, 9, 5)) },
      g(2026, 9, 3, "MORADIA", "Aluguel", 1800), g(2026, 9, 8, "ALIMENTACAO", "Mercado Extra", 640), g(2026, 9, 12, "LAZER", "Cinema", 90), g(2026, 9, 20, "TRANSPORTE", "99", 120),
      g(2026, 10, 3, "MORADIA", "Aluguel", 1800), g(2026, 10, 7, "ALIMENTACAO", "Mercado Extra", 380), g(2026, 10, 9, "LAZER", "Bar", 140),
    ],
  });
  for (const month of [9, 10]) {
    await prisma.budget.createMany({ data: ([["MORADIA", 1900], ["ALIMENTACAO", 900], ["LAZER", 300], ["TRANSPORTE", 300]] as const).map(([parentCategory, plannedAmount]) => ({ ...dono, year: 2026, month, parentCategory, plannedAmount })) });
    await prisma.monthlyPlan.create({ data: { ...dono, year: 2026, month, plannedIncome: 5200, plannedInvestment: 500 } });
  }
  await prisma.financialProfile.create({ data: { userId: bia.id, name: "Nós dois", kind: "CASAL", theme: "girly", isDefault: false } });
  console.log("Pronto: Ana (Pessoal + Ateliê), Clara (só a compra) e Bia (Pessoal + Casal).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
