import { prisma } from "@/lib/db/prisma";
import { comFiltro, lancamentosDosTotais } from "@/lib/casa/regras";
import type { AuthContext } from "@/lib/auth/session";
import { lerSobrou, sobrouDoMes, type SituacaoDoSobrou } from "./sobrou";

/**
 * O gráfico "Últimos 6 meses" do Resumo (rodada 58): Entrou × Gastou lado a lado, o guardado
 * em cima da barra de Gastou, e em cima de cada mês "sobrou R$ X", "empatou" ou "faltou R$ X".
 * O mês corrente entra "até agora", listrado. Uma conta só: sobrou = entrou − gastou − guardou.
 */
export type MesDoGrafico = {
  ano: number;
  mes: number;
  rotulo: string;
  nome: string;
  entrou: number;
  gastou: number;
  guardou: number;
  sobrou: number;
  situacao: SituacaoDoSobrou;
  /** O mês corrente: entra no gráfico, mas fora das médias. */
  atual: boolean;
};

const CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Os N meses até (e incluindo) o mês dado, do mais antigo ao atual. */
export function mesesAte(ano: number, mes: number, n: number): { ano: number; mes: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - (n - 1 - i), 1));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  });
}

export function montarMeses(
  valores: { ano: number; mes: number; entrou: number; gastou: number; guardou: number }[],
  ate: { ano: number; mes: number },
  n: number,
): MesDoGrafico[] {
  const porChave = new Map(valores.map((v) => [`${v.ano}-${v.mes}`, v]));
  return mesesAte(ate.ano, ate.mes, n).map(({ ano, mes }, i, todos) => {
    const v = porChave.get(`${ano}-${mes}`) ?? { entrou: 0, gastou: 0, guardou: 0 };
    const sobrou = sobrouDoMes(v);
    return { ano, mes, rotulo: CURTO[mes - 1], nome: NOME[mes - 1], entrou: v.entrou, gastou: v.gastou, guardou: v.guardou, sobrou, situacao: lerSobrou(sobrou, v.entrou === 0 && v.gastou === 0 && v.guardou === 0).situacao, atual: i === todos.length - 1 };
  });
}

/** O mês que abre selecionado: o último fechado (o anterior ao atual). */
export function mesSelecionadoDeInicio(meses: MesDoGrafico[]): number {
  const i = meses.findLastIndex((m) => !m.atual);
  return i >= 0 ? i : meses.length - 1;
}

/** "De maio a setembro você guardou R$ 2.600, R$ 520 por mês." Só os meses fechados com movimento. */
export function fraseDoGuardado(meses: MesDoGrafico[], money: (v: number) => string): string | null {
  const fechados = meses.filter((m) => !m.atual && (m.entrou > 0 || m.gastou > 0 || m.guardou > 0));
  if (fechados.length < 2) return null;
  const total = fechados.reduce((s, m) => s + m.guardou, 0);
  const media = total / fechados.length;
  return `De ${fechados[0].nome} a ${fechados[fechados.length - 1].nome} você guardou ${money(total)}, ${money(media)} por mês.`;
}

/** "Setembro: entrou R$ 7.700, gastou R$ 6.600, guardou R$ 900, sobrou R$ 200." */
export function linhaDoMes(m: MesDoGrafico, money: (v: number) => string): string {
  const Nome = m.nome.charAt(0).toUpperCase() + m.nome.slice(1);
  if (m.situacao === "vazio") return `${Nome}${m.atual ? " até agora" : ""}: sem lançamento.`;
  const s = lerSobrou(m.sobrou);
  const fim = s.situacao === "empatou" ? "empatou" : `${s.rotulo.toLowerCase()} ${money(s.valor)}`;
  return `${Nome}${m.atual ? " até agora" : ""}: entrou ${money(m.entrou)}, gastou ${money(m.gastou)}, guardou ${money(m.guardou)}, ${fim}.`;
}

/** Entrou, gastou e guardou de cada um dos meses pedidos, numa consulta só. */
export async function valoresDosMeses(ctx: AuthContext, meses: { ano: number; mes: number }[]) {
  const linhas = await prisma.monthlyEntry.groupBy({
    by: ["year", "month", "category"],
    // Casal simples: os meses dos dois, como o resto do Resumo.
    where: comFiltro(lancamentosDosTotais(ctx), { OR: meses.map((m) => ({ year: m.ano, month: m.mes })) }),
    _sum: { amount: true },
  });
  const porMes = new Map<string, { ano: number; mes: number; entrou: number; gastou: number; guardou: number }>();
  for (const l of linhas) {
    const k = `${l.year}-${l.month}`;
    const v = porMes.get(k) ?? { ano: l.year, mes: l.month, entrou: 0, gastou: 0, guardou: 0 };
    const total = Number(l._sum.amount ?? 0);
    if (l.category === "INCOME") v.entrou += total;
    else if (l.category === "EXPENSE") v.gastou += total;
    else v.guardou += total;
    porMes.set(k, v);
  }
  return [...porMes.values()];
}
