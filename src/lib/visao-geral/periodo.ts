/**
 * O seletor de mês da Visão geral (protótipo aprovado: "‹ Esse mês · 1 a 11 out ›" logo abaixo
 * das abas). Ele filtra Resumo, Orçamento e Transações pelo mesmo mês; Recorrentes não tem mês.
 *
 * O mês viaja na URL, para cada aba continuar no mesmo mês quando ela troca de aba:
 * - Resumo: /mensal/foco?mes=2026-09 (sem o parâmetro = o mês de agora);
 * - Orçamento: /orcamento/2026?mes=2026-09;
 * - Transações: /mensal/2026/9 (a rota já era por mês).
 *
 * Puro, sem React e sem banco: quem chama passa o "agora" (relógio do Brasil).
 */
export type MesDoPeriodo = { ano: number; mes: number };
export type AbaComMes = "resumo" | "orcamento" | "transacoes";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Quantos meses para trás a folha oferece. */
export const MESES_NA_FOLHA = 12;

const indice = (m: MesDoPeriodo) => m.ano * 12 + (m.mes - 1);
const doIndice = (i: number): MesDoPeriodo => ({ ano: Math.floor(i / 12), mes: (i % 12) + 1 });
export const mesDeAgora = (agora: Date): MesDoPeriodo => ({ ano: agora.getFullYear(), mes: agora.getMonth() + 1 });
export const mesmoMes = (a: MesDoPeriodo, b: MesDoPeriodo) => a.ano === b.ano && a.mes === b.mes;

/** "2026-09" → setembro de 2026. Inválido, no futuro ou antes de 2000: o mês de agora. */
export function lerMesEscolhido(valor: string | string[] | undefined | null, agora: Date): MesDoPeriodo {
  const atual = mesDeAgora(agora);
  const texto = Array.isArray(valor) ? valor[0] : valor;
  const m = typeof texto === "string" ? /^(\d{4})-(\d{1,2})$/.exec(texto.trim()) : null;
  if (!m) return atual;
  const escolhido = { ano: Number(m[1]), mes: Number(m[2]) };
  if (escolhido.mes < 1 || escolhido.mes > 12 || escolhido.ano < 2000) return atual;
  return indice(escolhido) > indice(atual) ? atual : escolhido;
}

export const paraParametro = (m: MesDoPeriodo) => `${m.ano}-${String(m.mes).padStart(2, "0")}`;

/** O nome e a linha de baixo, como no protótipo: "Esse mês · 1 a 11 out", "Mês passado · set 2026", "Agosto · 2026". */
export function rotuloDoPeriodo(m: MesDoPeriodo, agora: Date): { nome: string; sub: string } {
  const atual = mesDeAgora(agora);
  const nomeDoMes = MESES[m.mes - 1].charAt(0).toUpperCase() + MESES[m.mes - 1].slice(1);
  if (mesmoMes(m, atual)) {
    const dia = agora.getDate();
    return { nome: "Esse mês", sub: dia === 1 ? `1 ${CURTO[m.mes - 1]}` : `1 a ${dia} ${CURTO[m.mes - 1]}` };
  }
  if (indice(m) === indice(atual) - 1) return { nome: "Mês passado", sub: `${CURTO[m.mes - 1]} ${m.ano}` };
  return { nome: nomeDoMes, sub: String(m.ano) };
}

/** O mês ao lado (−1 ou +1), ou nulo se passaria do mês de agora ou do limite da folha. */
export function mesAoLado(m: MesDoPeriodo, passo: -1 | 1, agora: Date): MesDoPeriodo | null {
  const alvo = indice(m) + passo;
  const atual = indice(mesDeAgora(agora));
  if (alvo > atual || alvo < atual - (MESES_NA_FOLHA - 1)) return null;
  return doIndice(alvo);
}

/** Os meses da folha "Ver o período", do mais recente ao mais antigo. */
export function mesesDaFolha(agora: Date): MesDoPeriodo[] {
  const atual = indice(mesDeAgora(agora));
  return Array.from({ length: MESES_NA_FOLHA }, (_, k) => doIndice(atual - k));
}

/** Para onde leva escolher este mês na aba aberta. O mês de agora não leva parâmetro. */
export function hrefDoMes(aba: AbaComMes, m: MesDoPeriodo, agora: Date): string {
  const deAgora = mesmoMes(m, mesDeAgora(agora));
  if (aba === "transacoes") return `/mensal/${m.ano}/${m.mes}`;
  if (aba === "orcamento") return deAgora ? `/orcamento/${m.ano}` : `/orcamento/${m.ano}?mes=${paraParametro(m)}`;
  return deAgora ? "/mensal/foco" : `/mensal/foco?mes=${paraParametro(m)}`;
}

/** A aba de mês aberta e o mês que ela está mostrando, lidos da rota. Nulo fora das três abas. */
export function periodoDaRota(caminho: string, parametroMes: string | null, agora: Date): { aba: AbaComMes; mes: MesDoPeriodo } | null {
  const tr = /^\/mensal\/(\d{4})\/(\d{1,2})$/.exec(caminho);
  if (tr) return { aba: "transacoes", mes: lerMesEscolhido(`${tr[1]}-${tr[2]}`, agora) };
  if (caminho === "/mensal/foco") return { aba: "resumo", mes: lerMesEscolhido(parametroMes, agora) };
  const orc = /^\/orcamento\/(\d{4})$/.exec(caminho);
  if (orc) {
    const atual = mesDeAgora(agora);
    const ano = Number(orc[1]);
    const doParam = parametroMes ? lerMesEscolhido(parametroMes, agora) : null;
    if (doParam && doParam.ano === ano) return { aba: "orcamento", mes: doParam };
    return { aba: "orcamento", mes: ano === atual.ano ? atual : lerMesEscolhido(`${ano}-12`, agora) };
  }
  return null;
}
