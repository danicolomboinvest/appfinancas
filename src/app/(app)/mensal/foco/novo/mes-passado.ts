/**
 * O Resumo de um MÊS PASSADO (14/10/2026, pedido da Dani): "quando eu volto para ver os outros
 * meses, eu queria um resumo de como foi o fechamento do mês". Antes o seletor caía no Resumo
 * antigo, com "Para gastar nesta semana" e "Tudo resolvido", que só fazem sentido no mês de agora.
 *
 * Puro, sem banco: quem chama passa os valores dos meses e o estado do fechamento.
 */
import type { HeroiMesFechado } from "./dados";
import { categoriasQueMudaram, mesAnterior, porcentagemQueFicou, type CategoriaQueMudou, type Mes } from "./regras";
import { sobrouDoMes, type ValoresDoMes } from "@/lib/consolidation/sobrou";
import type { EstadoDoFechamento } from "../fechamento/estado";

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const indice = (m: Mes) => m.ano * 12 + (m.mes - 1);

/** Qual Resumo abre para o mês escolhido no seletor. */
export function telaDoMes(escolhido: Mes, agora: Mes): "atual" | "passado" | "futuro" {
  const d = indice(escolhido) - indice(agora);
  return d === 0 ? "atual" : d < 0 ? "passado" : "futuro";
}

const comDado = (v: ValoresDoMes) => v.entrou !== 0 || v.gastou !== 0 || v.guardou !== 0;

/**
 * O herói do mês fechado (o mesmo dos dias 1 a 7): quanto ficou, a % do que entrou, a % do mês
 * anterior e as 6 barras terminando nele. Mês sem nenhum lançamento: null (vira o estado vazio).
 */
export function heroiDoMesPassado(mes: Mes, valorDe: (m: Mes) => ValoresDoMes): HeroiMesFechado | null {
  const v = valorDe(mes);
  if (!comDado(v)) return null;
  const anterior = mesAnterior(mes);
  const va = valorDe(anterior);
  const seis = Array.from({ length: 6 }, (_, i) => {
    let m = mes;
    for (let k = 0; k < 5 - i; k++) m = mesAnterior(m);
    return m;
  });
  const ficou = sobrouDoMes(v);
  return {
    mes,
    entrou: v.entrou,
    ficou,
    guardou: v.guardou,
    pct: porcentagemQueFicou(v.entrou, ficou),
    pctAnterior: comDado(va) ? porcentagemQueFicou(va.entrou, sobrouDoMes(va)) : null,
    barras: seis.map((m) => ({ rotulo: NOMES[m.mes - 1].slice(0, 3), pct: comDado(valorDe(m)) ? porcentagemQueFicou(valorDe(m).entrou, sobrouDoMes(valorDe(m))) : null })),
  };
}

/**
 * "Para onde foi": as 4 categorias que mais mudaram, mês inteiro contra mês inteiro. Sem o mês
 * anterior no app, comparar com zero diria "tudo a mais": aí vão as 4 maiores, sem a diferença.
 */
export function paraOndeFoiNoMes(
  doMes: { valor: number; categoria: string }[],
  doAnterior: { valor: number; categoria: string }[],
  fixas: ReadonlySet<string>,
): { linhas: CategoriaQueMudou[]; comparou: boolean } {
  const semDia = (g: { valor: number; categoria: string }) => ({ valor: g.valor, categoria: g.categoria, dia: null });
  if (doAnterior.length === 0) {
    const linhas = categoriasQueMudaram(doMes.map(semDia), [], 31, 31, new Set(), 99)
      .sort((a, b) => b.atual - a.atual)
      .slice(0, 4);
    return { linhas, comparou: false };
  }
  return { linhas: categoriasQueMudaram(doMes.map(semDia), doAnterior.map(semDia), 31, 31, fixas, 4), comparou: true };
}

export type StatusDoFechamento = { tipo: "fechar"; rotulo: string } | { tipo: "fechado"; rotulo: string } | null;

/**
 * A linha do fechamento: o mês imediatamente anterior ainda não fechado (ou reaberto) ganha o
 * botão "Fechar setembro"; mês fechado, "Fechado em dd/mm"; os outros, nada.
 */
export function statusDoFechamento(mes: Mes, agora: Mes, f: { estado: EstadoDoFechamento; em: Date | null }): StatusDoFechamento {
  if (f.estado === "fechado") return { tipo: "fechado", rotulo: f.em ? `Fechado em ${ddmmNoBrasil(f.em)}` : "Fechado" };
  if (indice(agora) - indice(mes) === 1) return { tipo: "fechar", rotulo: `Fechar ${NOMES[mes.mes - 1]}` };
  return null;
}

/** "03/10", no calendário de Brasília (UTC−3, sem horário de verão). */
function ddmmNoBrasil(d: Date): string {
  const b = new Date(d.getTime() - 3 * 3_600_000);
  return `${String(b.getUTCDate()).padStart(2, "0")}/${String(b.getUTCMonth() + 1).padStart(2, "0")}`;
}
