/**
 * Conta de teste SÓ PARA O BANCO LOCAL (Postgres na própria máquina): a Ana canônica dos
 * protótipos (estudo-apps-financas/ana-canonica.md), para rodar o app e tirar as fotos das telas.
 *
 * Recusa rodar contra qualquer banco que não seja localhost: os números da Ana são de teste e
 * não podem virar semente em produção.
 *
 * Rodar com: DATABASE_URL="postgresql://spi:spi_local@localhost:54329/spi_local" npx tsx scripts/semear-local.ts
 * Entrar com: ana@exemplo.test / senha-de-teste-local (valores de teste, só existem no banco local).
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type ParentCategory, type Prisma, type StrategyAssetClass } from "@prisma/client";

const URL_DO_BANCO = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(URL_DO_BANCO).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Recusei: este script só roda no banco local (DATABASE_URL aponta para "${host || "nada"}").`);
  process.exit(1);
}

const prisma = new PrismaClient();
const EMAIL = "ana@exemplo.test";
const SENHA = "senha-de-teste-local";

type Linha = [ParentCategory, string, number, number];

async function main() {
  // Apaga a Ana anterior: os perfis levam junto tudo que é deles (lançamentos, plano, metas).
  const antiga = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (antiga) {
    await prisma.financialProfile.deleteMany({ where: { userId: antiga.id } });
    await prisma.user.delete({ where: { id: antiga.id } });
  }
  await prisma.allowedEmail.upsert({ where: { email: EMAIL }, update: { active: true }, create: { email: EMAIL, note: "conta de teste local" } });

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Ana Souza",
      passwordHash: await bcrypt.hash(SENHA, 10),
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
      theme: "light",
    },
  });
  const perfil = await prisma.financialProfile.create({
    data: { userId: user.id, name: "Pessoal", kind: "PESSOAL", theme: "padrao", isDefault: true },
  });
  const dono = { userId: user.id, profileId: perfil.id };

  const entradas: Prisma.MonthlyEntryCreateManyInput[] = [];
  let n = 0;
  const lanca = (year: number, month: number, dia: number, category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION", parent: ParentCategory | null, sub: string, desc: string, amount: number) => {
    entradas.push({ ...dono, year, month, category, parentCategory: parent, subcategory: sub, description: desc, amount, externalId: `local:${n++}`, entryDate: new Date(Date.UTC(year, month - 1, dia)) });
  };

  // Outubro de 2026 até o dia 7: entrou 7.700, gastou 4.059, guardou 900, sobrou 2.741.
  lanca(2026, 10, 2, "INCOME", null, "Salário", "Salário", 7700);
  const outubro: Linha[] = [
    ["MORADIA", "Aluguel", 2200, 1], ["MORADIA", "Condomínio", 300, 1], ["MORADIA", "Luz", 131, 4], ["MORADIA", "Internet", 35, 5],
    ["ALIMENTACAO", "Mercado", 238.4, 3], ["ALIMENTACAO", "Mercado", 121.6, 6],
    ["TRANSPORTE", "Aplicativo", 31.2, 3], ["TRANSPORTE", "Combustível", 149.8, 5],
    ["LAZER", "Streaming", 55.9, 1], ["LAZER", "Streaming", 21.9, 1], ["LAZER", "Assinatura", 4.9, 2], ["LAZER", "Restaurante", 103.3, 4],
    ["EDUCACAO", "Curso", 249, 2],
    ["SAUDE", "Plano de saúde", 389, 1], ["SAUDE", "Farmácia", 28, 6],
  ];
  const DESC: Record<string, string> = {
    Aluguel: "Aluguel", Condomínio: "Condomínio", Luz: "Enel", Internet: "Vivo Fibra", Mercado: "Pão de Açúcar",
    Aplicativo: "Uber", Combustível: "Posto Shell", Streaming: "Netflix", Assinatura: "iCloud", Restaurante: "iFood",
    Curso: "Curso de inglês", "Plano de saúde": "Amil", Farmácia: "Drogasil",
  };
  outubro.forEach(([cat, sub, valor, dia], i) => lanca(2026, 10, dia, "EXPENSE", cat, sub, i === 10 ? "Spotify" : DESC[sub] ?? sub, valor));
  lanca(2026, 10, 5, "INVESTMENT_CONTRIBUTION", null, "Aporte", "Aporte do mês", 900);

  // Maio a setembro: Entrou × Gastou × Guardou da canônica.
  const meses: [number, number, number, number][] = [[5, 7700, 6900, 700], [6, 7700, 7400, 300], [7, 7900, 8100, 0], [8, 7700, 7000, 700], [9, 7700, 6600, 900]];
  const PESOS: [ParentCategory, string, string, number][] = [
    ["MORADIA", "Aluguel", "Aluguel", 0.38], ["ALIMENTACAO", "Mercado", "Pão de Açúcar", 0.2], ["TRANSPORTE", "Aplicativo", "Uber", 0.1],
    ["LAZER", "Restaurante", "iFood", 0.1], ["SAUDE", "Plano de saúde", "Amil", 0.07], ["EDUCACAO", "Curso", "Curso de inglês", 0.05], ["OUTROS", "Compras", "Renner", 0.1],
  ];
  for (const [mes, entrou, gastou, guardou] of meses) {
    lanca(2026, mes, 2, "INCOME", null, "Salário", "Salário", entrou);
    // As assinaturas todo mês (o Raio-X e as Recorrentes reconhecem pelo extrato).
    lanca(2026, mes, 1, "EXPENSE", "LAZER", "Streaming", "Netflix", 55.9);
    lanca(2026, mes, 1, "EXPENSE", "LAZER", "Streaming", "Spotify", 21.9);
    lanca(2026, mes, 2, "EXPENSE", "LAZER", "Assinatura", "iCloud", 4.9);
    let resto = gastou - 55.9 - 21.9 - 4.9;
    PESOS.forEach(([cat, sub, desc, peso], i) => {
      const valor = i === PESOS.length - 1 ? Math.round(resto * 100) / 100 : Math.round(gastou * peso);
      resto -= valor;
      lanca(2026, mes, 5 + i, "EXPENSE", cat, sub, desc, valor);
    });
    if (guardou > 0) lanca(2026, mes, 6, "INVESTMENT_CONTRIBUTION", null, "Aporte", "Aporte do mês", guardou);
  }
  await prisma.monthlyEntry.createMany({ data: entradas });

  // O plano de outubro (7.300) e o de setembro, para o Orçamento ter com o que comparar.
  const PLANO: [ParentCategory, number][] = [["MORADIA", 2700], ["ALIMENTACAO", 1500], ["OUTROS", 950], ["TRANSPORTE", 800], ["LAZER", 600], ["EDUCACAO", 400], ["SAUDE", 350]];
  for (const month of [9, 10]) {
    await prisma.budget.createMany({ data: PLANO.map(([parentCategory, plannedAmount]) => ({ ...dono, year: 2026, month, parentCategory, plannedAmount })) });
    await prisma.monthlyPlan.create({ data: { ...dono, year: 2026, month, plannedIncome: 7700, plannedInvestment: 400 } });
  }

  const reserva = await prisma.goal.create({ data: { ...dono, name: "Reserva de emergência", targetAmount: 21000, currentAmount: 4200, monthlyContribution: 600, targetDate: new Date(Date.UTC(2029, 2, 1)), icon: "GENERICO", status: "ON_TRACK", createdAt: new Date(Date.UTC(2026, 0, 10)) } });
  const europa = await prisma.goal.create({ data: { ...dono, name: "Viagem Europa 2027", targetAmount: 20000, currentAmount: 1429, monthlyContribution: 1327, targetDate: new Date(Date.UTC(2027, 10, 1)), icon: "VIAGEM", status: "BEHIND", createdAt: new Date(Date.UTC(2026, 3, 1)) } });
  const carro = await prisma.goal.create({ data: { ...dono, name: "Trocar de carro", targetAmount: 30000, currentAmount: 8300, monthlyContribution: 600, targetDate: new Date(Date.UTC(2029, 9, 1)), icon: "CARRO", status: "ON_TRACK", createdAt: new Date(Date.UTC(2025, 9, 1)) } });

  const ativos: Prisma.AssetCreateManyInput[] = [
    { ...dono, name: "Tesouro Selic 2029", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "POS_FIXADO", objective: "RESERVA_EMERGENCIA", goalId: reserva.id, currentValue: 4200, investedValue: 4100 },
    { ...dono, name: "Tesouro IPCA+ 2035", assetClass: "TESOURO_DIRETO", fixedIncomeIndex: "IPCA", objective: "LIBERDADE_FINANCEIRA", currentValue: 6180, investedValue: 6000, taxaCompra: 0.075 },
    { ...dono, name: "Caixinha Nubank", assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO", objective: "META", goalId: europa.id, currentValue: 1429, investedValue: 1400 },
    { ...dono, name: "CDB Banco Inter 105% CDI", assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO", objective: "META", goalId: carro.id, currentValue: 8300, investedValue: 8000, taxaCompra: 1.05 },
    // Cotas e preço médio da Ana canônica (ana-canonica.md, item 5): somam R$ 41.569,51, com
    // R$ 114,51 de ganho desde a compra, e batem com os proventos da aba Proventos.
    { ...dono, name: "MXRF11", ticker: "MXRF11", assetClass: "FII", objective: "LIBERDADE_FINANCEIRA", quantity: 500, currentUnitPrice: 9.62, currentValue: 4810, investedValue: 5025 },
    { ...dono, name: "HGLG11", ticker: "HGLG11", assetClass: "FII", objective: "LIBERDADE_FINANCEIRA", quantity: 20, currentUnitPrice: 158.4, currentValue: 3168, investedValue: 3300 },
    { ...dono, name: "BBAS3", ticker: "BBAS3", assetClass: "ACAO", objective: "LIBERDADE_FINANCEIRA", quantity: 120, currentUnitPrice: 24.1, currentValue: 2892, investedValue: 3300 },
    { ...dono, name: "ITSA4", ticker: "ITSA4", assetClass: "ACAO", objective: "LIBERDADE_FINANCEIRA", quantity: 400, currentUnitPrice: 9.85, currentValue: 3940, investedValue: 4080 },
    { ...dono, name: "IVVB11", ticker: "IVVB11", assetClass: "INTERNACIONAL", objective: "LIBERDADE_FINANCEIRA", quantity: 15, currentUnitPrice: 352, currentValue: 5280, investedValue: 4950 },
    { ...dono, name: "VOO", ticker: "VOO", assetClass: "INTERNACIONAL", objective: "OUTRO", currency: "USD", nativeCurrentValue: 251.47, nativeInvestedValue: 238.53, exchangeRate: 5.45, currentValue: 1370.51, investedValue: 1300 },
  ];
  await prisma.asset.createMany({ data: ativos });

  // As contas do mês (Recorrentes): duas já pagas, duas a vencer.
  const dia = (d: number) => new Date(Date.UTC(2026, 9, d));
  await prisma.contaAPagar.createMany({
    data: [
      // Pagas no dia 1: a que repete já aponta para o próximo vencimento (1º de novembro).
      { ...dono, nome: "Aluguel", valor: 2200, vencimento: new Date(Date.UTC(2026, 10, 1)), diaDoMes: 1, repete: true, pagaEm: dia(1) },
      { ...dono, nome: "Condomínio", valor: 300, vencimento: new Date(Date.UTC(2026, 10, 1)), diaDoMes: 1, repete: true, pagaEm: dia(1) },
      { ...dono, nome: "Enel", valor: null, vencimento: dia(14), diaDoMes: 14, repete: true },
      { ...dono, nome: "Vivo Fibra", valor: 99.9, vencimento: dia(13), diaDoMes: 13, repete: true },
      { ...dono, nome: "Curso de inglês", valor: 249, vencimento: dia(20), diaDoMes: 20, repete: true },
    ],
  });
  // As dívidas da Ana (rodada 9b): duas para resolver (a fatura e o empréstimo) e duas saudáveis
  // (a mãe e o apê). Com R$ 200 a mais: livre em 11 meses, R$ 1.571 de juros; parcelas = 33% da renda.
  await prisma.divida.createMany({
    data: [
      { ...dono, tipo: "cartao_parcelado", credor: "Nubank", apelido: "Fatura", paraQue: "Compras do dia a dia", planejada: false, saldo: 1800, porMes: 300, parcelasAbertas: 6, parcelasTotal: 10, taxaMensal: null, diaVencimento: 10 },
      { ...dono, tipo: "emprestimo", credor: "Itaú", apelido: "Empréstimo", paraQue: "Emergência", planejada: false, saldo: 6000, porMes: 420, parcelasAbertas: 19, parcelasTotal: 24, taxaMensal: 2.9, diaVencimento: 5 },
      { ...dono, tipo: "pessoa", credor: "Mãe", apelido: "", paraQue: "Outro", planejada: true, saldo: 2000, porMes: 200, parcelasAbertas: 10, parcelasTotal: 15, taxaMensal: 0, diaVencimento: 15 },
      { ...dono, tipo: "financiamento_imovel", credor: "Caixa", apelido: "Apê", paraQue: "Casa", planejada: true, saldo: 180000, porMes: 1650, parcelasAbertas: 312, parcelasTotal: 360, taxaMensal: 0.8, diaVencimento: 20 },
    ],
  });

  // Carteira (versão nova): a estratégia Moderada da canônica e os proventos dos 12 meses.
  await prisma.financialProfile.update({ where: { id: perfil.id }, data: { perfilInvestidor: "moderado" } });
  const ALVO: [StrategyAssetClass, number][] = [["RENDA_FIXA_POS_FIXADA", 0.35], ["RENDA_FIXA_IPCA", 0.2], ["PREFIXADO", 0.05], ["ACOES_BRASIL", 0.15], ["FIIS", 0.15], ["EXTERIOR", 0.1], ["OUTROS", 0]];
  await prisma.portfolioStrategy.createMany({ data: ALVO.map(([assetClass, targetPercent]) => ({ ...dono, assetClass, targetPercent })) });
  // Proventos por TICKER (valem para qualquer conta local que tenha o ativo): R$ 672,60 em 12
  // meses e R$ 81,76 a caminho com as cotas da Ana. Datas reais de 2025 e 2026.
  const pg = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
  const MESES_PAGOS: [number, number][] = [[2025, 12], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5], [2026, 6], [2026, 7], [2026, 8], [2026, 9]];
  const MX = [28, 29, 30, 31, 32, 33, 34, 35, 35, 36];
  const HG = [13, 14, 14, 15, 15, 16, 16, 17, 17, 17];
  const ev = (ticker: string, kind: string, pagamento: Date, valuePerShare: number) => ({ ticker, kind, exDate: new Date(pagamento.getTime() - 14 * 864e5), paymentDate: pagamento, valuePerShare });
  await prisma.dividendEvent.deleteMany({ where: { ticker: { in: ["MXRF11", "HGLG11", "BBAS3", "ITSA4"] } } });
  await prisma.dividendEvent.createMany({
    data: [
      ...MESES_PAGOS.map(([a, m], i) => ev("MXRF11", "Dividendos", pg(a, m, 14), MX[i] / 500)),
      ...MESES_PAGOS.map(([a, m], i) => ev("HGLG11", "Dividendos", pg(a, m, 14), HG[i] / 20)),
      ...[pg(2026, 2, 27), pg(2026, 5, 29), pg(2026, 8, 28)].map((p) => ev("BBAS3", "Dividendos", p, 0.45)),
      ...[pg(2025, 12, 30), pg(2026, 3, 31), pg(2026, 6, 30)].map((p) => ev("ITSA4", "Dividendos", p, 0.028)),
      ev("MXRF11", "Dividendos", pg(2026, 10, 14), 0.1),
      ev("HGLG11", "Dividendos", pg(2026, 10, 14), 1.1),
      ev("ITSA4", "JSCP", pg(2026, 11, 1), 0.0244 / 0.85),
    ],
    skipDuplicates: true,
  });
  // A linha fina do herói da Carteira: um registro por mês, de out/2025 até hoje (conta de teste).
  const EVOLUCAO = [30120, 30980, 31650, 32400, 33210, 34050, 35020, 35900, 36880, 38100, 39400, 40620, 41569.51];
  await prisma.patrimonySnapshot.createMany({ data: EVOLUCAO.map((totalValue, i) => ({ ...dono, date: new Date(Date.UTC(2025, 9 + i, i === 12 ? 11 : 28)), totalValue })) });
  await prisma.emergencyFund.create({ data: { ...dono, targetMonths: 3, monthlyExpenseBase: 7000, targetAmount: 21000, currentAmount: 4200, monthlyContribution: 600, annualRate: 0.1 } });

  console.log(`Pronto: ${EMAIL} com ${entradas.length} lançamentos, 3 metas e ${ativos.length} ativos (banco local).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
