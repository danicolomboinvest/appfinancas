import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { CATEGORIAS_EMPRESA, ehEmpresa } from "@/lib/profiles/empresa";
import type { ParentCategory } from "@prisma/client";

export type TypicalExpense = {
  /** Média mensal dos gastos nos meses considerados. */
  monthlyAverage: number;
  /** Quantos meses fechados entraram na média. */
  monthsUsed: number;
};

/**
 * Saída de dinheiro que NÃO é gasto: aplicação (RDB, CDB, caixinha, Tesouro) e pagamento da
 * fatura do cartão (as compras da fatura já estão lançadas uma a uma). O extrato traz tudo
 * isso como débito, e contar como gasto dizia que a renda estava 130% comprometida.
 */
export const NAO_E_GASTO = [
  { subcategory: "Investimento" },
  ...["aplicação", "aplicacao", "caixinha", "rdb", "cdb", "tesouro direto", "pagamento de fatura", "pagamento fatura", "pgto fatura", "pag fatura", "fatura do cartão", "fatura do cartao"].map((t) => ({
    description: { contains: t, mode: "insensitive" as const },
  })),
];

/** Quantos meses fechados olhar para trás. Três já suaviza um mês atípico sem virar história antiga. */
const MESES = 3;

/**
 * Quanto custa um mês da vida da pessoa, segundo o que ela mesma já lançou.
 *
 * Existe por causa de um pedido concreto: as telas de planejamento pedem números que a pessoa
 * não tem na mão na hora, e "custo mensal" é o pior deles — ela abre a Reserva de Emergência,
 * não sabe de cabeça quanto gasta por mês, e fecha o app. Só que o app SABE: são os
 * lançamentos dela. Em vez de perguntar, ele oferece a resposta para ela aceitar ou corrigir.
 *
 * Só conta mês FECHADO: o mês corrente está pela metade e puxaria a média para baixo,
 * sugerindo uma reserva menor do que a necessária — errar para o lado frágil, justo aqui.
 *
 * Numa EMPRESA, o caixa de segurança cobre as despesas FIXAS (aluguel, equipe, pró-labore,
 * serviços): mercadoria e frete só existem se houver venda, e imposto só se houver receita.
 * Contar tudo pediria um caixa do tamanho do faturamento inteiro.
 */
export async function getTypicalMonthlyExpense(ctx: AuthContext): Promise<TypicalExpense | null> {
  const agora = nowInBrazil();
  const meses: { year: number; month: number }[] = [];
  for (let i = 1; i <= MESES; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const fixas = (Object.keys(CATEGORIAS_EMPRESA) as ParentCategory[]).filter((k) => CATEGORIAS_EMPRESA[k].natureza === "fixa");
  // Empresa: só as frentes fixas (e as categorias personalizadas, que entram como fixas).
  const soFixas = ehEmpresa(ctx.profileKind) ? { AND: [{ OR: [{ parentCategory: { in: fixas } }, { parentCategory: null }] }] } : {};
  // O que não é gasto é somado À PARTE e subtraído: um filtro NOT no SQL também descartaria os
  // lançamentos sem descrição ou sem subcategoria (NULL), que são a maioria dos feitos à mão.
  const [linhas, naoGasto, mesesReais] = await Promise.all([
    prisma.monthlyEntry.groupBy({
      by: ["year", "month"],
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: meses, ...soFixas },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["year", "month"],
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", AND: [{ OR: meses }, { OR: NAO_E_GASTO }, ...(soFixas.AND ?? [])] },
      _sum: { amount: true },
    }),
    // Mês que só tem as cópias automáticas da despesa fixa (a pessoa não lançou nada nele) não é
    // "o que ela gastou": puxaria a média pra baixo. Vale o mês com algum lançamento feito no
    // mês ou depois dele (importado ou à mão).
    prisma.monthlyEntry.groupBy({
      by: ["year", "month"],
      where: {
        userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE",
        OR: meses.map((m) => ({ year: m.year, month: m.month, createdAt: { gte: new Date(Date.UTC(m.year, m.month - 1, 1, 3)) } })),
      },
      _count: { _all: true },
    }),
  ]);
  const reais = new Set(mesesReais.map((m) => `${m.year}-${m.month}`));
  const fora = new Map(naoGasto.map((l) => [`${l.year}-${l.month}`, Number(l._sum.amount ?? 0)]));

  const comGasto = linhas
    .map((l) => ({ ...l, _sum: { amount: Number(l._sum.amount ?? 0) - (fora.get(`${l.year}-${l.month}`) ?? 0) } }))
    .filter((l) => l._sum.amount > 0 && reais.has(`${l.year}-${l.month}`));
  if (comGasto.length === 0) return null;

  const soma = comGasto.reduce((total, l) => total + Number(l._sum.amount ?? 0), 0);
  return { monthlyAverage: soma / comGasto.length, monthsUsed: comGasto.length };
}

/**
 * Renda de um mês típico, pra quem não planejou a renda: a MEDIANA do que entrou nos últimos 3
 * meses fechados. Mediana, não o mês passado: o 13º, as férias ou o freela que caiu atrasado
 * dobram um mês e fariam qualquer compra "caber". Resgate de aplicação não é renda.
 */
export async function getRendaTipica(ctx: AuthContext): Promise<{ valor: number; meses: number } | null> {
  const agora = nowInBrazil();
  const meses: { year: number; month: number }[] = [];
  for (let i = 1; i <= MESES; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  const naoRenda = ["resgate", "caixinha", "rdb", "cdb", "estorno"].map((t) => ({ description: { contains: t, mode: "insensitive" as const } }));
  const [linhas, fora] = await Promise.all([
    prisma.monthlyEntry.groupBy({ by: ["year", "month"], where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", OR: meses }, _sum: { amount: true } }),
    prisma.monthlyEntry.groupBy({ by: ["year", "month"], where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", AND: [{ OR: meses }, { OR: naoRenda }] }, _sum: { amount: true } }),
  ]);
  const tirar = new Map(fora.map((l) => [`${l.year}-${l.month}`, Number(l._sum.amount ?? 0)]));
  const valores = linhas
    .map((l) => Number(l._sum.amount ?? 0) - (tirar.get(`${l.year}-${l.month}`) ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  if (valores.length === 0) return null;
  const meio = Math.floor(valores.length / 2);
  const valor = valores.length % 2 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2;
  return { valor, meses: valores.length };
}
