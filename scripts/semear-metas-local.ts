/**
 * As metas da Ana com o histórico de aportes do protótipo (ana-canonica.md, seção 3), SÓ PARA O
 * BANCO LOCAL. Rodar DEPOIS do semear-local.ts:
 *
 *   DATABASE_URL="postgresql://spi:spi_local@localhost:54329/<banco>" npx tsx scripts/semear-metas-local.ts
 *
 * O que faz:
 * - Cada meta ganha os aportes mês a mês do protótipo, ligados a ela e ao ativo dela (então o
 *   guardado continua sendo o valor do ativo: Reserva R$ 4.200, Europa R$ 1.429, Carro R$ 8.300).
 * - Início, rendimento (10% ao ano), tipo e foto como no protótipo.
 * - Outubro: R$ 300 aplicados na Reserva e o "Pix para você" de R$ 600 do dia 5, ainda sem meta
 *   (é o "Foi para esta meta?" da Europa). Outubro continua com R$ 900 guardados.
 *
 * Atenção: os aportes "Aporte do mês" sem meta de março a setembro saem e dão lugar aos das metas,
 * então o Guardou desses meses no Resumo muda (a canônica tem os dois números e eles não fecham
 * entre si; aqui valem os das metas).
 */
import { PrismaClient, type Prisma } from "@prisma/client";

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

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) throw new Error("Rode antes o scripts/semear-local.ts.");
  const perfil = await prisma.financialProfile.findFirst({ where: { userId: user.id, isDefault: true }, select: { id: true } });
  if (!perfil) throw new Error("A Ana não tem perfil.");
  const dono = { userId: user.id, profileId: perfil.id };

  const metas = await prisma.goal.findMany({ where: dono, include: { assets: { select: { id: true } } } });
  const porNome = (n: string) => {
    const g = metas.find((x) => x.name === n);
    if (!g) throw new Error(`Meta ${n} não encontrada.`);
    return g;
  };
  const reserva = porNome("Reserva de emergência");
  const europa = porNome("Viagem Europa 2027");
  const carro = porNome("Trocar de carro");

  // Os aportes sem meta de março a outubro saem (os das metas entram no lugar).
  await prisma.monthlyEntry.deleteMany({ where: { ...dono, category: "INVESTMENT_CONTRIBUTION", goalId: null, year: 2026, month: { gte: 3 } } });
  await prisma.monthlyEntry.deleteMany({ where: { ...dono, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null } } });

  const ajustes: [typeof reserva, Prisma.GoalUpdateInput][] = [
    [reserva, { icon: "RESERVA", fotoUrl: "/fotos/metas/reserva.jpg", currentAmount: 0, annualRate: 0.1, monthlyContribution: 600, createdAt: new Date(2026, 2, 1) }],
    [europa, { icon: "VIAGEM", fotoUrl: "/fotos/metas/europa.jpg", currentAmount: 0, annualRate: 0.1, monthlyContribution: 1327, createdAt: new Date(2026, 0, 1), targetDate: new Date(2027, 10, 1, 12) }],
    [carro, { icon: "CARRO", fotoUrl: "/fotos/metas/carro.jpg", currentAmount: 0, annualRate: 0.1, monthlyContribution: 600, createdAt: new Date(2025, 9, 1), targetDate: new Date(2029, 9, 1, 12) }],
  ];
  for (const [g, data] of ajustes) await prisma.goal.update({ where: { id: g.id }, data: { ...data, checkinDismissedMonth: null, aporteAdiadoMes: null, aportesRecusados: [] } });
  await prisma.goal.update({ where: { id: reserva.id }, data: { targetDate: new Date(2029, 2, 1, 12) } });

  type Ap = [ano: number, mes: number, dia: number, valor: number, origem: "Pix para você" | "Aplicação"];
  const historico: [typeof reserva, Ap[]][] = [
    [reserva, [3, 4, 5, 6, 7, 8, 9].map((m): Ap => [2026, m, 5, 600, "Aplicação"]).concat([[2026, 10, 5, 300, "Aplicação"]])],
    [europa, [[2026, 1, 10, 300, "Pix para você"], [2026, 3, 8, 200, "Pix para você"], [2026, 5, 12, 329, "Aplicação"], [2026, 7, 6, 200, "Pix para você"], [2026, 8, 5, 400, "Aplicação"]]],
    [carro, [[2025, 10, 3, 1700, "Aplicação"], ...[11, 12].map((m): Ap => [2025, m, 5, 600, "Pix para você"]), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m): Ap => [2026, m, 5, 600, "Pix para você"])]],
  ];
  let n = 0;
  for (const [g, lista] of historico) {
    const ativo = g.assets[0];
    for (const [ano, mes, dia, valor, origem] of lista) {
      const e = await prisma.monthlyEntry.create({
        data: { ...dono, year: ano, month: mes, category: "INVESTMENT_CONTRIBUTION", subcategory: "Aporte", description: `${origem} · ${g.name}`, amount: valor, goalId: g.id, entryDate: new Date(Date.UTC(ano, mes - 1, dia)), externalId: `local-meta:${n++}`, createdAt: new Date(Date.UTC(ano, mes - 1, dia)) },
      });
      // Ligado ao ativo da meta: o guardado continua sendo o valor do ativo (não conta duas vezes).
      if (ativo) await prisma.contributionAllocation.create({ data: { ...dono, entryId: e.id, assetId: ativo.id, amount: valor } });
    }
  }
  // O Pix de 5 de outubro ainda sem meta: "Foi para esta meta?".
  await prisma.monthlyEntry.create({
    data: { ...dono, year: 2026, month: 10, category: "INVESTMENT_CONTRIBUTION", subcategory: "Aporte", description: "Pix para Ana Souza", amount: 600, entryDate: new Date(Date.UTC(2026, 9, 5)), externalId: `local-meta:${n++}` },
  });
  console.log(`Pronto: ${n} aportes nas metas da Ana (banco local).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
