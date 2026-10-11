import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { type ContaParaRegra } from "@/lib/contas/contas";
import { depoisDePagarComRegra, regraDaConta } from "@/lib/contas/frequencia";

/** Os campos da frequência livre (seção 3.17). Opcionais: quem chama sem eles grava como antes. */
export type CamposDeFrequencia = {
  intervalo?: number | null;
  unidade?: string | null;
  mesesEscolhidos?: number[];
  parcelas?: number | null;
  parcelaAtual?: number | null;
  valorEhTotal?: boolean;
  aproximado?: boolean;
};

export type ContaAPagarInput = {
  nome: string;
  /** null = o valor muda todo mês (contas de antes). A aproximada guarda a estimativa aqui. */
  valor: number | null;
  vencimento: Date;
  repete: boolean;
  lembrar: boolean;
} & CamposDeFrequencia;

export type ContaDaTela = ContaParaRegra & {
  pagaEm: Date | null;
  diaDoMes: number | null;
  intervalo: number | null;
  unidade: string | null;
  mesesEscolhidos: number[];
  parcelas: number | null;
  parcelaAtual: number | null;
  valorEhTotal: boolean;
  aproximado: boolean;
};

type Linha = {
  id: string; nome: string; valor: unknown; vencimento: Date; repete: boolean; lembrar: boolean; quitada: boolean; pagaEm: Date | null; diaDoMes: number | null;
  intervalo: number | null; unidade: string | null; mesesEscolhidos: number[] | null; parcelas: number | null; parcelaAtual: number | null; valorEhTotal: boolean; aproximado: boolean;
};

function paraTela(c: Linha): ContaDaTela {
  return {
    id: c.id, nome: c.nome, valor: c.valor == null ? null : Number(c.valor), vencimento: c.vencimento, repete: c.repete, lembrar: c.lembrar, quitada: c.quitada, pagaEm: c.pagaEm,
    diaDoMes: c.diaDoMes, intervalo: c.intervalo, unidade: c.unidade, mesesEscolhidos: c.mesesEscolhidos ?? [], parcelas: c.parcelas, parcelaAtual: c.parcelaAtual, valorEhTotal: c.valorEhTotal, aproximado: c.aproximado,
  };
}

/** As contas em aberto do perfil, da que vence primeiro. As quitadas não voltam. */
export async function listarContasAPagar(ctx: AuthContext): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: false }, orderBy: [{ vencimento: "asc" }, { nome: "asc" }] });
  return contas.map(paraTela);
}

/** As últimas que ela pagou e não repetem (pra desfazer um "paguei" sem querer). */
export async function listarQuitadasRecentes(ctx: AuthContext, limite = 5): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: true }, orderBy: { pagaEm: "desc" }, take: limite });
  return contas.map(paraTela);
}

export async function criarContaAPagar(ctx: AuthContext, d: ContaAPagarInput) {
  return prisma.contaAPagar.create({ data: { ...doDono(ctx), ...d, diaDoMes: d.vencimento.getUTCDate() } });
}

/** Mudar a data muda o dia de sempre também: ela escolheu outro dia. */
export async function editarContaAPagar(ctx: AuthContext, id: string, d: ContaAPagarInput) {
  return prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { ...d, diaDoMes: d.vencimento.getUTCDate() } });
}

export async function apagarContaAPagar(ctx: AuthContext, id: string) {
  return prisma.contaAPagar.deleteMany({ where: { id, ...doDono(ctx) } });
}

/**
 * "Paguei": a que repete vai pro mês seguinte; a outra fica quitada. Não lança gasto: quem importa
 * extrato veria o mesmo pagamento duas vezes.
 *
 * O `vencimento` no filtro do update segura o toque duplo: o segundo "paguei" não acha mais a
 * conta no vencimento antigo e não pula mais um mês.
 */
export async function marcarContaPaga(ctx: AuthContext, id: string) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx), quitada: false } });
  if (!c) return null;
  const depois = depoisDePagarComRegra(c, regraDaConta(c), c.diaDoMes ?? undefined);
  const r = await prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx), vencimento: c.vencimento, quitada: false }, data: { ...depois, pagaEm: new Date() } });
  if (r.count === 0) return null;
  return { antes: c.vencimento, antesParcela: c.parcelaAtual, ...depois };
}

/** Desfaz o último "paguei": volta o vencimento que ela tinha marcado como pago. */
export async function desfazerContaPaga(ctx: AuthContext, id: string, vencimentoAntes: Date, parcelaAntes?: number | null) {
  return prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { vencimento: vencimentoAntes, quitada: false, pagaEm: null, ...(parcelaAntes !== undefined ? { parcelaAtual: parcelaAntes } : {}) } });
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Quanto a conta deu nos últimos 3 meses fechados, achada pelo nome nos gastos (descrição ou
 * subcategoria: "Luz" acha a "Enel" de subcategoria Luz). Um valor por mês, do mais antigo para o
 * mais novo. Só serve de sugestão: ela toca para usar.
 */
export async function historicoDaConta(ctx: AuthContext, nome: string, hoje: Date): Promise<{ mes: string; valor: number }[]> {
  const alvo = normalizar(nome);
  if (alvo.length < 3) return [];
  const meses = [1, 2, 3].map((k) => {
    const x = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - k, 1));
    return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1 };
  });
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...doDono(ctx), category: "EXPENSE", OR: meses },
    select: { year: true, month: true, description: true, subcategory: true, amount: true },
    take: 2000,
  });
  const casa = (t: string | null) => {
    if (!t) return false;
    const n = normalizar(t);
    return n.length >= 3 && (n.includes(alvo) || alvo.includes(n));
  };
  return meses
    .reverse()
    .map(({ year, month }) => ({
      mes: `${year}-${String(month).padStart(2, "0")}`,
      valor: Math.round(linhas.filter((l) => l.year === year && l.month === month && (casa(l.description) || casa(l.subcategory))).reduce((s, l) => s + Number(l.amount), 0) * 100) / 100,
    }))
    .filter((m) => m.valor > 0);
}
