import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * O resultado das alunas em números — o "depoimento sem depoimento".
 *
 * A Dani quer poder dizer "a galera que usa o SPI Finance fez isso" sem expor ninguém. Então
 * aqui tudo é AGREGADO e anônimo, e existem duas travas que não podem ser afrouxadas:
 *
 * 1. Nenhum número sai de um grupo pequeno demais. Com três pessoas no grupo, "a média
 *    guardou R$ 4.000" conta a vida de alguém identificável, principalmente pra Dani, que
 *    conhece as alunas. Abaixo do mínimo, o número não é calculado — a tela diz que ainda
 *    falta gente, e não zero.
 * 2. Nada de extremos individuais ("a que mais guardou"), porque isso é uma pessoa só, com
 *    outro nome.
 *
 * As contas também são conservadoras de propósito: quem vai publicar esses números não pode
 * ser desmentida. Mediana em vez de média onde um caso fora da curva distorce, e sempre com o
 * tamanho da amostra do lado pra ninguém ler "78%" achando que são 78% de 500 pessoas.
 */

/** Grupo menor que isto não vira número nenhum. */
export const MIN_AMOSTRA = 5;

/**
 * Lançamento acima disto denuncia dado contaminado, não riqueza: conta de empresa importada
 * junto com a pessoal, ou — o caso que encontramos de verdade — extrato lido errado, em que
 * "23.390,97" virou 2.339.097 e um PIX enviado entrou como receita.
 *
 * Quem tem um lançamento assim fica INTEIRO de fora das estatísticas, porque a distorção
 * contamina todos os meses dela. É melhor publicar um número de menos gente do que publicar
 * "a galera poupa 69% da renda" e ser desmentida por quem conhece o assunto.
 */
export const TETO_LANCAMENTO_CONFIAVEL = 200_000;

export type ResultadoNumero = {
  /** Null = grupo pequeno demais pra publicar. A tela mostra o motivo, não um zero. */
  valor: number | null;
  /** Quantas pessoas entraram nesta conta. */
  pessoas: number;
};

export type CommunityResults = {
  geradoEm: Date;
  /** Contas que abriram o app nos últimos 30 dias. */
  ativas30d: number;
  totalContas: number;
  /** Meses fechados considerados (o mês corrente fica de fora: ainda está acontecendo). */
  mesesConsiderados: number;

  /** Quanto a base inteira já organizou no app (renda + gasto + aporte lançados). */
  totalOrganizado: number;
  lancamentos: number;

  /** Quanto foi guardado de fato: soma dos aportes lançados. */
  totalGuardado: ResultadoNumero;
  /** Quantas pessoas guardaram alguma coisa em algum mês fechado. */
  pessoasQueGuardaram: number;

  /** Mediana da taxa de poupança (renda − gasto) ÷ renda, entre quem tem mês fechado com renda. */
  taxaPoupancaMediana: ResultadoNumero;
  /** Quantas, entre quem tem 2+ meses fechados, melhoraram a taxa do primeiro pro último mês. */
  melhoraram: ResultadoNumero;

  /** Quem tem meta e já guardou pra ela. */
  comMeta: number;
  guardadoEmMetas: ResultadoNumero;
  /** Reservas de emergência que já chegaram no alvo. */
  reservaCompleta: ResultadoNumero;

  /** Contas deixadas de fora por terem valor fora de escala (quase sempre extrato lido errado). */
  contasForaDaConta: number;

};

function resultado(valores: number[], calcular: (v: number[]) => number): ResultadoNumero {
  if (valores.length < MIN_AMOSTRA) return { valor: null, pessoas: valores.length };
  return { valor: calcular(valores), pessoas: valores.length };
}

function mediana(v: number[]): number {
  const ordenado = [...v].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

export async function getCommunityResults(): Promise<CommunityResults> {
  const agora = nowInBrazil();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  /** Mês corrente não entra: ele ainda está acontecendo e puxaria todo mundo pra baixo. */
  const ehFechado = (ano: number, mes: number) => ano < anoAtual || (ano === anoAtual && mes < mesAtual);

  const [clientes, totalContas, ativas30d, porMes, metas, reservas] = await Promise.all([
    prisma.user.findMany({ where: { role: "CLIENT" }, select: { id: true, email: true } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.usageEvent
      .findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { userId: true }, distinct: ["userId"] })
      .then((r) => r.length),
    prisma.monthlyEntry.groupBy({
      by: ["userId", "year", "month", "category"],
      _sum: { amount: true },
      _count: true,
    }),
    prisma.goal.findMany({ select: { userId: true, targetAmount: true, currentAmount: true } }),
    prisma.emergencyFund.findMany({ select: { userId: true, targetAmount: true, currentAmount: true } }),
  ]);

  // Só conta de aluna: admin e conta de teste não são resultado de ninguém.
  const ehAluna = new Set(clientes.filter((u) => !/applereview|@example\.com/i.test(u.email)).map((u) => u.id));

  // Quem tem valor fora de escala sai inteiro: o dado dela está contaminado.
  const contaminadas = new Set(
    (
      await prisma.monthlyEntry.findMany({
        where: { amount: { gt: TETO_LANCAMENTO_CONFIAVEL } },
        select: { userId: true },
        distinct: ["userId"],
      })
    ).map((e) => e.userId),
  );
  const vale = (userId: string) => ehAluna.has(userId) && !contaminadas.has(userId);

  // Reorganiza tudo por pessoa e por mês fechado.
  type Mes = { renda: number; gasto: number; aporte: number };
  const porPessoa = new Map<string, Map<string, Mes>>();
  let totalOrganizado = 0;
  let lancamentos = 0;
  const mesesVistos = new Set<string>();

  for (const linha of porMes) {
    if (!vale(linha.userId)) continue;
    const valor = Number(linha._sum.amount ?? 0);
    totalOrganizado += valor;
    lancamentos += linha._count;
    if (!ehFechado(linha.year, linha.month)) continue;
    const chaveMes = `${linha.year}-${String(linha.month).padStart(2, "0")}`;
    mesesVistos.add(chaveMes);
    const meses = porPessoa.get(linha.userId) ?? new Map<string, Mes>();
    const m = meses.get(chaveMes) ?? { renda: 0, gasto: 0, aporte: 0 };
    if (linha.category === "INCOME") m.renda += valor;
    else if (linha.category === "EXPENSE") m.gasto += valor;
    else m.aporte += valor;
    meses.set(chaveMes, m);
    porPessoa.set(linha.userId, meses);
  }

  // Taxa de poupança por pessoa: a mediana dos meses fechados dela com renda lançada.
  const taxas: number[] = [];
  const guardadoPorPessoa: number[] = [];
  const deltas: number[] = [];

  for (const meses of porPessoa.values()) {
    const ordenados = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b));
    // Mês só entra se tem renda E gasto lançados. Mês com renda e nenhum gasto dá "poupou
    // 100%", que não é resultado: é gente que importou o salário e ainda não lançou as contas.
    const comRenda = ordenados.filter(([, m]) => m.renda > 0 && m.gasto > 0);
    if (comRenda.length > 0) {
      taxas.push(mediana(comRenda.map(([, m]) => (m.renda - m.gasto) / m.renda)));
    }
    const guardou = ordenados.reduce((s, [, m]) => s + m.aporte, 0);
    if (guardou > 0) guardadoPorPessoa.push(guardou);
    // Melhorou? Compara o PRIMEIRO com o ÚLTIMO mês fechado com renda da pessoa.
    if (comRenda.length >= 2) {
      const taxaDe = (m: Mes) => (m.renda - m.gasto) / m.renda;
      deltas.push(taxaDe(comRenda[comRenda.length - 1][1]) - taxaDe(comRenda[0][1]));
    }
  }

  // Metas: quanto já foi guardado pra elas (o que a pessoa registrou como valor atual).
  const porMeta = new Map<string, number>();
  for (const g of metas) {
    if (!vale(g.userId)) continue;
    porMeta.set(g.userId, (porMeta.get(g.userId) ?? 0) + Number(g.currentAmount));
  }
  const guardadoMetas = [...porMeta.values()].filter((v) => v > 0);

  const reservasValidas = reservas.filter((r) => vale(r.userId));
  const reservasCompletas = reservasValidas.filter(
    (r) => Number(r.targetAmount) > 0 && Number(r.currentAmount) >= Number(r.targetAmount),
  ).length;

  const totalGuardado = resultado(guardadoPorPessoa, (v) => v.reduce((s, x) => s + x, 0));
  const taxaPoupancaMediana = resultado(taxas, mediana);
  const melhoraram = resultado(deltas, (v) => v.filter((d) => d > 0.01).length / v.length);
  const guardadoEmMetas = resultado(guardadoMetas, (v) => v.reduce((s, x) => s + x, 0));
  const reservaCompleta = resultado(
    reservasValidas.filter((r) => Number(r.targetAmount) > 0).map(() => 1),
    () => reservasCompletas,
  );

  return {
    contasForaDaConta: contaminadas.size,
    geradoEm: agora,
    ativas30d,
    totalContas,
    mesesConsiderados: mesesVistos.size,
    totalOrganizado,
    lancamentos,
    totalGuardado,
    pessoasQueGuardaram: guardadoPorPessoa.length,
    taxaPoupancaMediana,
    melhoraram,
    comMeta: porMeta.size,
    guardadoEmMetas,
    reservaCompleta,
  };
}

/**
 * As frases prontas pra copiar. Ficam aqui fora porque quem sabe escrever dinheiro é o
 * formatador de moeda do app (a moeda é escolha da pessoa), e o repositório não tem acesso a ele.
 */
export function frasesDosResultados(r: CommunityResults, money: (n: number) => string): string[] {
  const frases: string[] = [];
  if (r.totalGuardado.valor !== null) {
    frases.push(
      `${r.totalGuardado.pessoas} pessoas que usam o SPI Finance guardaram ${money(r.totalGuardado.valor)} desde que começaram a registrar.`,
    );
  }
  if (r.taxaPoupancaMediana.valor !== null) {
    frases.push(
      `A taxa de poupança típica de quem usa o app é de ${Math.round(r.taxaPoupancaMediana.valor * 100)}% da renda (mediana de ${r.taxaPoupancaMediana.pessoas} pessoas com pelo menos um mês fechado, com entradas e gastos lançados).`,
    );
  }
  if (r.melhoraram.valor !== null) {
    frases.push(
      `Entre as ${r.melhoraram.pessoas} pessoas com dois ou mais meses no app, ${Math.round(r.melhoraram.valor * 100)}% aumentaram a taxa de poupança do primeiro mês para o último.`,
    );
  }
  if (r.guardadoEmMetas.valor !== null) {
    frases.push(`${r.guardadoEmMetas.pessoas} pessoas já têm ${money(r.guardadoEmMetas.valor)} guardados para metas com nome e prazo.`);
  }
  if (r.lancamentos > 0) {
    frases.push(`No total, ${money(r.totalOrganizado)} em entradas, gastos e aportes já passaram pela organização do app.`);
  }
  return frases;
}
