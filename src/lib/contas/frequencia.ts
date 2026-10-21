/**
 * Conta recorrente com regra livre (versão nova, seção 3.17 e rodadas 4, 10 e 10-adendo).
 *
 * - "Não repete", "A cada N dias/semanas/meses/anos" (N de 1 a 36) ou "Em meses que eu escolho".
 * - Parcelada de 2 a 48 vezes: o valor guardado é sempre a parcela.
 * - Média por mês = valor × ocorrências por ano ÷ 12 (R$ 1.560 a cada 2 semanas dá R$ 3.380).
 * - Conta que não é todo mês mostra "guarde R$ X por mês" = valor ÷ meses até o vencimento.
 * - Valor aproximado: a estimativa é a média dos 3 últimos valores reais (112, 131, 141 dá ~128).
 *
 * As contas de antes (sem intervalo) continuam valendo: `repete` = todo mês, sem `repete` = não
 * repete. Datas são dias de calendário em UTC meia-noite, como em contas.ts. Puro, sem banco.
 */
import { diaDe, proximoMes } from "./contas";

export type Unidade = "dias" | "semanas" | "meses" | "anos";
export const UNIDADES: readonly Unidade[] = ["dias", "semanas", "meses", "anos"];

export type Regra = { tipo: "nao_repete" } | { tipo: "a_cada"; n: number; unidade: Unidade } | { tipo: "meses"; meses: number[] };

export type CamposDaRegra = { repete: boolean; intervalo: number | null; unidade: string | null; mesesEscolhidos: number[]; parcelas: number | null };

const ehUnidade = (u: unknown): u is Unidade => typeof u === "string" && (UNIDADES as readonly string[]).includes(u);

/** A regra a partir das colunas da conta (as antigas viram "todo mês" ou "não repete"). */
export function regraDaConta(c: CamposDaRegra): Regra {
  const meses = [...new Set((c.mesesEscolhidos ?? []).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (meses.length > 0) return { tipo: "meses", meses };
  if (c.intervalo && c.intervalo >= 1 && ehUnidade(c.unidade)) return { tipo: "a_cada", n: Math.min(36, c.intervalo), unidade: c.unidade };
  // Parcelada sem regra própria: uma parcela por mês.
  if (c.repete || (c.parcelas ?? 0) > 1) return { tipo: "a_cada", n: 1, unidade: "meses" };
  return { tipo: "nao_repete" };
}

/** As colunas para gravar uma regra (o inverso de regraDaConta). */
export function camposDaRegra(r: Regra): { repete: boolean; intervalo: number | null; unidade: Unidade | null; mesesEscolhidos: number[] } {
  if (r.tipo === "nao_repete") return { repete: false, intervalo: null, unidade: null, mesesEscolhidos: [] };
  if (r.tipo === "meses") return { repete: true, intervalo: null, unidade: null, mesesEscolhidos: [...r.meses].sort((a, b) => a - b) };
  return { repete: true, intervalo: r.n, unidade: r.unidade, mesesEscolhidos: [] };
}

const DIA = 86_400_000;
const somaDias = (d: Date, n: number) => new Date(diaDe(d).getTime() + n * DIA);

function somaMeses(d: Date, n: number, diaOriginal: number): Date {
  let x = diaDe(d);
  for (let i = 0; i < n; i++) x = proximoMes(x, diaOriginal);
  return x;
}

/** O vencimento seguinte a `data`, pela regra. Null quando não repete. */
export function proximaOcorrencia(data: Date, r: Regra, diaOriginal = data.getUTCDate()): Date | null {
  if (r.tipo === "nao_repete") return null;
  if (r.tipo === "a_cada") {
    if (r.unidade === "dias") return somaDias(data, r.n);
    if (r.unidade === "semanas") return somaDias(data, 7 * r.n);
    return somaMeses(data, r.unidade === "anos" ? 12 * r.n : r.n, diaOriginal);
  }
  // Em meses escolhidos: o próximo mês da lista depois do mês desta data.
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  const prox = r.meses.find((m) => m > mes);
  const [a, m] = prox ? [ano, prox] : [ano + 1, r.meses[0]];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1, Math.min(diaOriginal, ultimo)));
}

/**
 * Todos os vencimentos de `primeira` em diante que caem entre `de` e `ate` (inclusive). `restantes`
 * limita a quantidade (parcelas que faltam). No máximo 400 por chamada, por segurança.
 */
export function ocorrencias(primeira: Date, r: Regra, de: Date, ate: Date, diaOriginal = primeira.getUTCDate(), restantes = Infinity): Date[] {
  const out: Date[] = [];
  let d: Date | null = diaDe(primeira);
  let n = 0;
  while (d && d.getTime() <= ate.getTime() && n < restantes && n < 400) {
    if (d.getTime() >= diaDe(de).getTime()) out.push(d);
    n++;
    d = proximaOcorrencia(d, r, diaOriginal);
  }
  return out;
}

/** Quantas vezes por ano a conta cai (a semana do ano tem 52; o ano, 365 dias). */
export function ocorrenciasPorAno(r: Regra): number {
  if (r.tipo === "nao_repete") return 0;
  if (r.tipo === "meses") return r.meses.length;
  if (r.unidade === "dias") return 365 / r.n;
  if (r.unidade === "semanas") return 52 / r.n;
  if (r.unidade === "meses") return 12 / r.n;
  return 1 / r.n;
}

/** Média por mês = valor × ocorrências por ano ÷ 12, em reais inteiros. */
export function mediaPorMes(valor: number, r: Regra): number {
  return Math.round((valor * ocorrenciasPorAno(r)) / 12);
}

/** Conta que cai menos de uma vez por mês: é das "Contas do ano" e ganha o "guarde por mês". */
export function ehMenosQueMensal(r: Regra): boolean {
  return r.tipo !== "nao_repete" && ocorrenciasPorAno(r) < 12;
}

/** Meses de calendário de `hoje` até o vencimento (out → jun do ano seguinte = 8). No mínimo 1. */
export function mesesAte(vencimento: Date, hoje: Date): number {
  const n = (vencimento.getUTCFullYear() - hoje.getUTCFullYear()) * 12 + (vencimento.getUTCMonth() - hoje.getUTCMonth());
  return Math.max(1, n);
}

/** Vence no mês de `hoje` ou já venceu (e não foi paga). */
export function venceNesteMes(vencimento: Date, hoje: Date): boolean {
  return (vencimento.getUTCFullYear() - hoje.getUTCFullYear()) * 12 + (vencimento.getUTCMonth() - hoje.getUTCMonth()) <= 0;
}

/**
 * "Guarde R$ X por mês": o valor dividido pelos meses até o vencimento, arredondado para cima. A
 * que vence neste mês é para pagar agora, não para separar aos poucos: 0 (21/10/2026, os R$ 2.500
 * anuais com vencimento no mês apareciam como "R$ 2.500/mês").
 */
export function guardePorMes(valor: number, vencimento: Date, hoje: Date): number {
  if (venceNesteMes(vencimento, hoje)) return 0;
  return Math.ceil(valor / mesesAte(vencimento, hoje));
}

/** A estimativa da conta que varia: a média dos 3 últimos valores reais, em reais. */
export function estimativaAproximada(valores: number[]): number | null {
  const ult = valores.filter((v) => v > 0).slice(-3);
  if (ult.length === 0) return null;
  return Math.round(ult.reduce((s, v) => s + v, 0) / ult.length);
}

export type MesDaPrevia = { ano: number; mes: number; vezes: number; total: number };

/** A prévia dos 12 meses a partir do mês de `hoje`: quantas vezes cai em cada mês e quanto soma. */
export function previaDoze(primeira: Date, r: Regra, valor: number, hoje: Date, restantes = Infinity, diaOriginal = primeira.getUTCDate()): MesDaPrevia[] {
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 12, 0));
  const datas = r.tipo === "nao_repete" ? (primeira >= inicio && primeira <= fim ? [diaDe(primeira)] : []) : ocorrencias(primeira, r, inicio, fim, diaOriginal, restantes);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1));
    const vezes = datas.filter((x) => x.getUTCFullYear() === d.getUTCFullYear() && x.getUTCMonth() === d.getUTCMonth()).length;
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, vezes, total: Math.round(vezes * valor * 100) / 100 };
  });
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SINGULAR: Record<Unidade, string> = { dias: "dia", semanas: "semana", meses: "mês", anos: "ano" };

/** A regra em poucas palavras: "todo mês", "a cada 2 semanas", "todo ano", "em jan e jul". */
export function textoDaRegra(r: Regra): string {
  if (r.tipo === "nao_repete") return "não repete";
  if (r.tipo === "meses") {
    const nomes = r.meses.map((m) => MES_CURTO[m - 1]);
    return `em ${nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0]}`;
  }
  if (r.n === 1) return r.unidade === "semanas" ? "toda semana" : r.unidade === "dias" ? "todo dia" : `todo ${SINGULAR[r.unidade]}`;
  return `a cada ${r.n} ${r.unidade}`;
}

/** Depois do "paguei": o próximo vencimento pela regra; a parcelada anda uma parcela e acaba na última. */
export function depoisDePagarComRegra(
  c: { vencimento: Date; parcelas: number | null; parcelaAtual: number | null },
  r: Regra,
  diaOriginal?: number,
): { vencimento: Date; quitada: boolean; parcelaAtual: number | null } {
  const atual = c.parcelaAtual ?? 1;
  if (c.parcelas && c.parcelas > 1 && atual >= c.parcelas) return { vencimento: diaDe(c.vencimento), quitada: true, parcelaAtual: atual };
  const prox = proximaOcorrencia(c.vencimento, r, diaOriginal);
  if (!prox) return { vencimento: diaDe(c.vencimento), quitada: true, parcelaAtual: c.parcelaAtual };
  return { vencimento: prox, quitada: false, parcelaAtual: c.parcelas && c.parcelas > 1 ? atual + 1 : c.parcelaAtual };
}
