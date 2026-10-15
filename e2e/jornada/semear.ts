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
import { dataDoDia, dia, ehDiaUtil } from "../../src/lib/portfolio/calendario-anbima";
import { CDI_DE_TESTE, CDB_DA_ANA } from "./rendimento";

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
  await semearRendimento(ana.id);

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

  await semearDuda();
  console.log("Pronto: Ana (Pessoal + Ateliê), Clara (só a compra), Bia (Pessoal + Casal) e Duda (números).");
}

/**
 * O rendimento da renda fixa (15/10/2026): as séries do Banco Central de mentira (só no banco
 * local, CDI fixo em cada dia útil de 2026, para o valor andar todo dia da jornada) e o CDB de
 * 110% do CDI que a Ana comprou há 6 meses.
 */
async function semearRendimento(anaId: string) {
  const cdi = [];
  for (let d = dia(2025, 12, 1); d < dia(2027, 1, 1); d++) if (ehDiaUtil(d)) cdi.push({ indice: "cdi", data: dataDoDia(d), valor: CDI_DE_TESTE * 100, fonte: "Banco Central" });
  // O IPCA de 2026 como o Banco Central publicou (SGS 433), até setembro.
  const ipca = [0.33, 0.7, 0.88, 0.67, 0.58, 0.16, 0.07, -0.32, 0.82].map((valor, i) => ({ indice: "ipca", data: dataDoDia(dia(2026, i + 1, 1)), valor, fonte: "Banco Central" }));
  await prisma.serieIndice.createMany({ data: [...cdi, ...ipca] });
  const pessoal = await prisma.financialProfile.findFirstOrThrow({ where: { userId: anaId, kind: "PESSOAL" } });
  await prisma.asset.create({
    data: {
      userId: anaId,
      profileId: pessoal.id,
      name: CDB_DA_ANA.nome,
      assetClass: "RENDA_FIXA",
      fixedIncomeIndex: "POS_FIXADO",
      taxaCompra: CDB_DA_ANA.percentual,
      objective: "LIBERDADE_FINANCEIRA",
      investedValue: CDB_DA_ANA.investido,
      currentValue: CDB_DA_ANA.investido,
      acquisitionDate: new Date(`${CDB_DA_ANA.compra}T00:00:00Z`),
    },
  });
}

/**
 * Duda (duda@exemplo.test), a conta da jornada dos números (numeros.jornada.ts): setembro e o
 * começo de outubro, duas compras parceladas (uma de verdade e uma que ela vai dizer que "Não é
 * parcela"), aporte e resgate no mesmo mês, uma meta, uma dívida e dois investimentos. Cada
 * número aparece em mais de uma tela, e a jornada confere que todas dizem o mesmo.
 */
async function semearDuda() {
  await prisma.allowedEmail.upsert({ where: { email: "duda@exemplo.test" }, update: { active: true }, create: { email: "duda@exemplo.test", note: "jornada: números", source: "HUBLA" } });
  const duda = await prisma.user.create({
    data: { email: "duda@exemplo.test", name: "Duda Lima", passwordHash: await bcrypt.hash(SENHA, 10), emailVerifiedAt: new Date(), onboardedAt: new Date(), theme: "light", novidadesVersaoNova: "pulou", novidadesVistasEm: new Date() },
  });
  const perfil = await prisma.financialProfile.create({ data: { userId: duda.id, name: "Pessoal", kind: "PESSOAL", theme: "padrao", isDefault: true } });
  const dono = { userId: duda.id, profileId: perfil.id };
  const viagem = await prisma.goal.create({ data: { ...dono, name: "Viagem Chile", targetAmount: 6000, currentAmount: 0, monthlyContribution: 500, targetDate: new Date(Date.UTC(2027, 6, 1)), icon: "VIAGEM", status: "ON_TRACK", createdAt: new Date(Date.UTC(2026, 5, 1)) } });
  let n = 0;
  const l = (year: number, month: number, dia: number, category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION", parentCategory: ParentCategory | null, description: string, amount: number, extra: { goalId?: string } = {}) => ({
    ...dono, year, month, category, parentCategory, description, amount, externalId: `jornada:duda:${n++}`, entryDate: new Date(Date.UTC(year, month - 1, dia)), ...extra,
  });
  await prisma.monthlyEntry.createMany({
    data: [
      // Setembro: entrou 6.000, gastou 3.320, guardou 500, ficou 2.180.
      l(2026, 9, 5, "INCOME", null, "Salário", 6000),
      l(2026, 9, 3, "EXPENSE", "MORADIA", "Aluguel", 1500), l(2026, 9, 9, "EXPENSE", "ALIMENTACAO", "Mercado Dia", 690.5),
      l(2026, 9, 14, "EXPENSE", "TRANSPORTE", "Metrô", 199.5), l(2026, 9, 18, "EXPENSE", "LAZER", "Cinema", 140),
      l(2026, 9, 10, "EXPENSE", "OUTROS", "Geladeira Brastemp (2/10)", 320), l(2026, 9, 12, "EXPENSE", "EDUCACAO", "Curso Online (1/6)", 150),
      l(2026, 9, 20, "EXPENSE", "SAUDE", "Farmácia", 320),
      l(2026, 9, 6, "INVESTMENT_CONTRIBUTION", null, "Aporte Viagem", 500, { goalId: viagem.id }),
      // Outubro até o dia 14: entrou 6.000, gastou 2.402,40, guardou 600 − 150 (resgate) = 450.
      l(2026, 10, 5, "INCOME", null, "Salário", 6000),
      l(2026, 10, 3, "EXPENSE", "MORADIA", "Aluguel", 1500), l(2026, 10, 8, "EXPENSE", "ALIMENTACAO", "Mercado Dia", 412.4),
      l(2026, 10, 10, "EXPENSE", "OUTROS", "Geladeira Brastemp (3/10)", 320), l(2026, 10, 12, "EXPENSE", "EDUCACAO", "Curso Online (2/6)", 150),
      l(2026, 10, 9, "EXPENSE", "LAZER", "Bar", 20),
      l(2026, 10, 6, "INVESTMENT_CONTRIBUTION", null, "Aporte Viagem", 600, { goalId: viagem.id }),
      l(2026, 10, 11, "INVESTMENT_CONTRIBUTION", null, "Resgate Viagem", -150, { goalId: viagem.id }),
    ],
  });
  // O plano de setembro a dezembro (janeiro de 2027 fica sem plano: a virada do ano).
  for (const month of [9, 10, 11, 12]) {
    await prisma.budget.createMany({
      data: ([["MORADIA", 1600], ["ALIMENTACAO", 900], ["TRANSPORTE", 300], ["LAZER", 300], ["EDUCACAO", 200], ["SAUDE", 300], ["OUTROS", 400]] as const).map(([parentCategory, plannedAmount]) => ({ ...dono, year: 2026, month, parentCategory, plannedAmount })),
    });
    await prisma.monthlyPlan.create({ data: { ...dono, year: 2026, month, plannedIncome: 6000, plannedInvestment: 600 } });
  }
  await prisma.divida.create({ data: { ...dono, tipo: "emprestimo", credor: "Banco Exemplo", apelido: "Empréstimo", paraQue: "Emergência", planejada: false, saldo: 3600, porMes: 300, parcelasAbertas: 12, parcelasTotal: 18, taxaMensal: 2.1, diaVencimento: 10 } });
  await prisma.asset.createMany({
    data: [
      { ...dono, name: "CDB Viagem", assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO", objective: "META", currentValue: 2150.75, investedValue: 2000 },
      { ...dono, name: "Tesouro Selic 2029", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "POS_FIXADO", objective: "RESERVA_EMERGENCIA", currentValue: 4300.4, investedValue: 4200 },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
