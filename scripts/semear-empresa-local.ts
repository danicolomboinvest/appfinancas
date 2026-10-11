/**
 * O "Ateliê da Ana" (MEI de doces) SÓ PARA O BANCO LOCAL: o perfil Empresa da Ana canônica
 * (estudo-apps-financas/ana-canonica.md, seções 10 e 12), para rodar a Empresa refeita e tirar as fotos.
 * Rode antes o semear-local.ts (cria a Ana e o Pessoal dela).
 *
 * Recusa rodar contra qualquer banco que não seja localhost: os números da Ana são de teste.
 * Deixa a Empresa como perfil ativo (para as fotos). Para voltar ao Pessoal, troque pela foto do topo.
 *
 * Rodar com: DATABASE_URL="postgresql://...@localhost:54329/<banco>" npx tsx scripts/semear-empresa-local.ts
 */
import { PrismaClient, type ParentCategory, type Prisma } from "@prisma/client";

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Recusei: este script só roda no banco local (DATABASE_URL aponta para "${host || "nada"}").`);
  process.exit(1);
}

const prisma = new PrismaClient();
const NOME = "Ateliê da Ana";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "ana@exemplo.test" }, select: { id: true } });
  if (!user) throw new Error("Rode antes o scripts/semear-local.ts (a Ana não existe).");
  await prisma.financialProfile.deleteMany({ where: { userId: user.id, kind: "EMPRESA" } });
  const pessoal = await prisma.financialProfile.findFirst({ where: { userId: user.id, kind: "PESSOAL" } });
  await prisma.financialProfile.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  const perfil = await prisma.financialProfile.create({
    data: {
      userId: user.id,
      name: NOME,
      kind: "EMPRESA",
      icon: "store",
      theme: pessoal?.theme ?? "padrao",
      isDefault: true,
      position: 2,
      empresa: { tipo: "MEI", faz: "doces", formas: ["credito", "debito", "pix", "boleto"], prazoCredito: 30, salario: null, diaDoSalario: 5, lembreteDas: true, taxas: { credito: 3.1, debito: 1.4 }, horasPorMes: 120, abertoEm: "2026-10-01T12:00:00.000Z" },
    },
  });
  const dono = { userId: user.id, profileId: perfil.id };
  const linhas: Prisma.MonthlyEntryCreateManyInput[] = [];
  let n = 0;
  const data = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
  const saida = (y: number, m: number, d: number, parent: ParentCategory, sub: string, desc: string, amount: number) =>
    linhas.push({ ...dono, year: y, month: m, category: "EXPENSE", parentCategory: parent, subcategory: sub, description: desc, amount, entryDate: data(y, m, d), externalId: `local-emp:${n++}` });
  const venda = (y: number, m: number, d: number, amount: number, extra: Partial<Prisma.MonthlyEntryCreateManyInput> = {}) =>
    linhas.push({ ...dono, year: y, month: m, category: "INCOME", subcategory: "Vendas", description: extra.cliente ? `Venda, ${extra.cliente}` : "Venda no balcão", amount, entryDate: data(y, m, d), externalId: `local-emp:${n++}`, ...extra });

  // As contas de todo mês (gás 240, celular 66, site 59, Canva 35) e a guia de R$ 86,05 no dia 18.
  const contas = (y: number, m: number) => {
    saida(y, m, 15, "MORADIA", "Luz", "Gás e energia", 240);
    saida(y, m, 12, "MORADIA", "Internet/Telefone", "Celular do ateliê", 66);
    saida(y, m, 25, "MORADIA", "Software e assinaturas", "Site de encomendas", 59);
    saida(y, m, 2, "MORADIA", "Software e assinaturas", "Canva", 35);
    saida(y, m, 18, "IMPOSTOS", "DAS (Simples Nacional)", "DAS MEI", 86.05);
  };
  // Vendas de balcão divididas em `k` vendas, alternando o jeito de pagar.
  const balcao = (y: number, m: number, total: number, k: number) => {
    const formas = ["credito", "pix", "credito", "debito"] as const;
    const cada = Math.floor(total / k);
    for (let i = 0; i < k; i++) {
      const v = i === k - 1 ? total - cada * (k - 1) : cada;
      const f = formas[i % formas.length];
      const dia = 1 + Math.floor((i * 27) / k);
      venda(y, m, dia, v, { formaDeRecebimento: f });
    }
  };

  // Novembro de 2025 a agosto de 2026 (canônica, seção 12): faturou, lucro e número de vendas.
  const historico: [number, number, number, number, number][] = [
    [2025, 11, 6800, 3700, 30], [2025, 12, 8900, 5100, 37], [2026, 1, 4600, 2380, 20], [2026, 2, 5000, 2700, 22], [2026, 3, 6300, 3450, 27],
    [2026, 4, 6700, 3700, 29], [2026, 5, 6800, 3770, 29], [2026, 6, 7120, 3960, 31], [2026, 7, 8800, 5240, 35], [2026, 8, 9200, 5310, 36],
  ];
  // Os clientes de julho e agosto (Café Lume, Buffet Sol e Carla somam 5.760, 3.900 e 1.150 com setembro).
  const clientesJulAgo: Record<number, [string, number, string][]> = {
    7: [["Café Lume", 1440, "boleto"], ["Buffet Sol", 1500, "pix"], ["Carla Mendes", 450, "credito"]],
    8: [["Café Lume", 2880, "boleto"], ["Buffet Sol", 1500, "pix"], ["Carla Mendes", 460, "credito"]],
  };
  for (const [y, m, fat, luc, k] of historico) {
    const cl = clientesJulAgo[m] && y === 2026 ? clientesJulAgo[m] : [];
    cl.forEach(([c, v, f], i) => venda(y, m, 5 + i * 7, v, { cliente: c, formaDeRecebimento: f, recebeEm: f === "boleto" ? data(y, m, 15 + i) : null, recebidoEm: f === "boleto" ? data(y, m, 15 + i) : null }));
    balcao(y, m, fat - cl.reduce((s, [, v]) => s + v, 0), k - cl.length);
    contas(y, m);
    const variaveis = Math.round((fat - luc - 486.05) * 100) / 100;
    saida(y, m, 8, "ALIMENTACAO", "Matéria-prima", "Insumos", Math.round(variaveis * 0.62 * 100) / 100);
    saida(y, m, 9, "ALIMENTACAO", "Embalagens", "Embalagens", Math.round(variaveis * 0.12 * 100) / 100);
    saida(y, m, 10, "EDUCACAO", "Anúncios", "Anúncios", Math.round(variaveis * 0.11 * 100) / 100);
    saida(y, m, 28, "EDUCACAO", "Taxas de cartão/maquininha", "Taxa Mercado Pago", Math.round(variaveis * 0.06 * 100) / 100);
    saida(y, m, 22, "TRANSPORTE", "Frete", "Entregas", Math.round((variaveis - Math.round(variaveis * 0.62 * 100) / 100 - Math.round(variaveis * 0.12 * 100) / 100 - Math.round(variaveis * 0.11 * 100) / 100 - Math.round(variaveis * 0.06 * 100) / 100) * 100) / 100);
  }

  // Setembro (canônica, seção 10): 38 vendas, R$ 9.000. Crédito 5.600, Pix 1.500, boleto 1.000, débito 900.
  venda(2026, 9, 26, 1000, { cliente: "Café Lume", formaDeRecebimento: "boleto", recebeEm: data(2026, 9, 30), recebidoEm: data(2026, 9, 30) });
  venda(2026, 9, 26, 440, { cliente: "Café Lume", formaDeRecebimento: "pix" });
  venda(2026, 9, 24, 900, { cliente: "Buffet Sol", formaDeRecebimento: "pix" });
  venda(2026, 9, 22, 240, { cliente: "Carla Mendes", formaDeRecebimento: "credito", recebeEm: data(2026, 10, 13) });
  // O crédito de setembro cai em outubro e no começo de novembro (os R$ 4.400 das próximas 4 semanas):
  // 13/out 1.320 (com a Carla), 20/out 960, 27/out 1.480 e 2/nov 400 (+ a Carla de outubro, 5/nov).
  for (let i = 0; i < 10; i++) venda(2026, 9, 1 + (i % 5), 120, { formaDeRecebimento: "credito", recebeEm: data(2026, 10, 1 + (i % 5)) });
  const credito: [number, number, number, number][] = [[12, 1080, 10, 13], [19, 960, 10, 20], [26, 1480, 10, 27], [30, 400, 11, 2]];
  credito.forEach(([d, v, mc, dc]) => venda(2026, 9, d, v, { formaDeRecebimento: "credito", recebeEm: data(2026, mc, dc) }));
  for (let i = 0; i < 4; i++) venda(2026, 9, 6 + i, 60, { formaDeRecebimento: "credito", recebeEm: data(2026, 10, 6 + i) });
  for (let i = 0; i < 10; i++) venda(2026, 9, 3 + i * 2, 90, { formaDeRecebimento: "debito", recebeEm: data(2026, 9, 4 + i * 2) });
  [25, 25, 25, 25, 30, 30].forEach((v, i) => venda(2026, 9, 7 + i * 3, v, { formaDeRecebimento: "pix" }));
  saida(2026, 9, 8, "ALIMENTACAO", "Matéria-prima", "Insumos", 2150);
  saida(2026, 9, 9, "ALIMENTACAO", "Embalagens", "Embalagens", 420);
  saida(2026, 9, 10, "EDUCACAO", "Anúncios", "Anúncios", 400);
  saida(2026, 9, 22, "TRANSPORTE", "Frete", "Entregas", 310);
  saida(2026, 9, 28, "EDUCACAO", "Taxas de cartão/maquininha", "Taxa Mercado Pago", 198);
  contas(2026, 9);

  // Outubro até hoje: R$ 2.900 vendidos; a Marina comprou um bolo de aniversário e combinou o Pix para o dia 6.
  venda(2026, 10, 3, 1440, { cliente: "Café Lume", formaDeRecebimento: "boleto", recebeEm: data(2026, 10, 3), recebidoEm: data(2026, 10, 3) });
  venda(2026, 10, 5, 450, { cliente: "Buffet Sol", formaDeRecebimento: "pix" });
  venda(2026, 10, 6, 240, { cliente: "Carla Mendes", formaDeRecebimento: "credito", recebeEm: data(2026, 11, 5) });
  venda(2026, 10, 1, 450, { cliente: "Marina Costa", description: "Bolo de aniversário", formaDeRecebimento: "pix", recebeEm: data(2026, 10, 6) });
  for (let i = 0; i < 8; i++) venda(2026, 10, 1 + (i % 7), 40, { formaDeRecebimento: "pix" });
  saida(2026, 10, 4, "ALIMENTACAO", "Matéria-prima", "Insumos", 980);
  saida(2026, 10, 4, "ALIMENTACAO", "Embalagens", "Embalagens", 140);
  saida(2026, 10, 2, "MORADIA", "Software e assinaturas", "Canva", 35);

  await prisma.monthlyEntry.createMany({ data: linhas });

  // As contas do ateliê (Recorrentes): o Canva já pago no dia 2; a guia vence dia 20.
  const dia = (d: number) => new Date(Date.UTC(2026, 9, d));
  await prisma.contaAPagar.createMany({
    data: [
      { ...dono, nome: "Guia do MEI", valor: 86.05, vencimento: dia(20), diaDoMes: 20, repete: true, lembrar: true },
      { ...dono, nome: "Gás e energia", valor: 240, vencimento: dia(15), diaDoMes: 15, repete: true },
      { ...dono, nome: "Celular do ateliê", valor: 66, vencimento: dia(12), diaDoMes: 12, repete: true },
      { ...dono, nome: "Site de encomendas", valor: 59, vencimento: dia(25), diaDoMes: 25, repete: true },
      { ...dono, nome: "Canva", valor: 35, vencimento: new Date(Date.UTC(2026, 10, 2)), diaDoMes: 2, repete: true, pagaEm: new Date(Date.UTC(2026, 9, 2, 15)) },
    ],
  });
  // O caixa de R$ 6.800 (paga 41 dias de contas, guia e salário).
  await prisma.emergencyFund.create({ data: { ...dono, targetMonths: 3, monthlyExpenseBase: 4986, targetAmount: 14958, currentAmount: 6800, monthlyContribution: 0, annualRate: 0.1 } });

  console.log(`Pronto: ${NOME} com ${linhas.length} lançamentos (banco local). Perfil ativo: Empresa.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
