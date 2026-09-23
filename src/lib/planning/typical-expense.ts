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
  const linhas = await prisma.monthlyEntry.groupBy({
    by: ["year", "month"],
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: meses, ...soFixas },
    _sum: { amount: true },
  });

  const comGasto = linhas.filter((l) => Number(l._sum.amount ?? 0) > 0);
  if (comGasto.length === 0) return null;

  const soma = comGasto.reduce((total, l) => total + Number(l._sum.amount ?? 0), 0);
  return { monthlyAverage: soma / comGasto.length, monthsUsed: comGasto.length };
}
