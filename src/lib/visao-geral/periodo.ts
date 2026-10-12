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

// ---------------------------------------------------------------------------------------------
// Períodos que não são um mês inteiro (protótipo: "Ver o período", 11/10/2026): Últimos 7 dias,
// Esse trimestre, Trimestre passado, Esse ano e o Período personalizado (calendário). Viajam na
// URL como ?periodo=7d|tri|tri-ant|ano ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD.
// ---------------------------------------------------------------------------------------------

export type TipoDeIntervalo = "7d" | "tri" | "tri-ant" | "ano" | "custom";
export type Dia = { ano: number; mes: number; dia: number };
export type Intervalo = { tipo: TipoDeIntervalo; de: Dia; ate: Dia };

const diaDe = (d: Date): Dia => ({ ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() });
const paraData = (d: Dia) => new Date(d.ano, d.mes - 1, d.dia);
export const diaParaTexto = (d: Dia) => `${d.ano}-${String(d.mes).padStart(2, "0")}-${String(d.dia).padStart(2, "0")}`;
const ordemDoDia = (d: Dia) => d.ano * 10000 + d.mes * 100 + d.dia;
export const ultimoDia = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

function lerDia(texto: string | null | undefined): Dia | null {
  const m = typeof texto === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto) : null;
  if (!m) return null;
  const d = { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  if (d.mes < 1 || d.mes > 12 || d.dia < 1 || d.dia > ultimoDia(d.ano, d.mes) || d.ano < 2000) return null;
  return d;
}

/** O intervalo de cada atalho da folha, contado a partir de hoje (nunca passa de hoje). */
export function intervaloDoTipo(tipo: Exclude<TipoDeIntervalo, "custom">, agora: Date): Intervalo {
  const hoje = diaDe(agora);
  if (tipo === "7d") {
    const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6);
    return { tipo, de: diaDe(ini), ate: hoje };
  }
  if (tipo === "ano") return { tipo, de: { ano: hoje.ano, mes: 1, dia: 1 }, ate: hoje };
  const triIni = Math.floor((hoje.mes - 1) / 3) * 3 + 1;
  if (tipo === "tri") return { tipo, de: { ano: hoje.ano, mes: triIni, dia: 1 }, ate: hoje };
  const ini = new Date(hoje.ano, triIni - 1 - 3, 1);
  const fimMes = new Date(hoje.ano, triIni - 1, 0);
  return { tipo, de: diaDe(ini), ate: diaDe(fimMes) };
}

/** Lê ?periodo= ou ?de=&ate= (o personalizado). Nada válido: null (vale o mês). */
export function lerIntervalo(params: { periodo?: string | null; de?: string | null; ate?: string | null }, agora: Date): Intervalo | null {
  const p = params.periodo;
  if (p === "7d" || p === "tri" || p === "tri-ant" || p === "ano") return intervaloDoTipo(p, agora);
  let de = lerDia(params.de);
  let ate = lerDia(params.ate ?? params.de);
  if (!de || !ate) return null;
  const hoje = diaDe(agora);
  if (ordemDoDia(ate) < ordemDoDia(de)) [de, ate] = [ate, de];
  if (ordemDoDia(de) > ordemDoDia(hoje)) return null;
  if (ordemDoDia(ate) > ordemDoDia(hoje)) ate = hoje;
  return { tipo: "custom", de, ate };
}

/** O que vai na URL de cada aba para este intervalo. */
export function parametrosDoIntervalo(i: Intervalo): string {
  return i.tipo === "custom" ? `de=${diaParaTexto(i.de)}&ate=${diaParaTexto(i.ate)}` : `periodo=${i.tipo}`;
}

export function hrefDoIntervalo(aba: AbaComMes, i: Intervalo): string {
  const q = parametrosDoIntervalo(i);
  if (aba === "transacoes") return `/mensal/periodo?${q}`;
  if (aba === "orcamento") return `/orcamento/${i.ate.ano}?${q}`;
  return `/mensal/foco?${q}`;
}

/** Os nomes do protótipo: "Últimos 7 dias · 5 a 11 out", "Esse trimestre · out a dez", "3 a 9 out · 7 dias". */
export function rotuloDoIntervalo(i: Intervalo): { nome: string; sub: string } {
  const curto = (d: Dia) => CURTO[d.mes - 1];
  const mesmoMesDoIntervalo = i.de.ano === i.ate.ano && i.de.mes === i.ate.mes;
  const dias = Math.round((paraData(i.ate).getTime() - paraData(i.de).getTime()) / 86_400_000) + 1;
  const faixa = mesmoMesDoIntervalo ? `${i.de.dia} a ${i.ate.dia} ${curto(i.ate)}` : `${i.de.dia} ${curto(i.de)} a ${i.ate.dia} ${curto(i.ate)}`;
  if (i.tipo === "7d") return { nome: "Últimos 7 dias", sub: faixa };
  if (i.tipo === "ano") return { nome: "Esse ano", sub: `jan a ${curto(i.ate)}` };
  if (i.tipo === "tri") return { nome: "Esse trimestre", sub: `${curto(i.de)} a ${CURTO[Math.min(11, i.de.mes + 1)]}` };
  if (i.tipo === "tri-ant") return { nome: "Trimestre passado", sub: `${curto(i.de)} a ${curto(i.ate)}` };
  if (ordemDoDia(i.de) === ordemDoDia(i.ate)) return { nome: `${i.de.dia} ${curto(i.de)}`, sub: "um dia" };
  return { nome: faixa, sub: `${dias} dias` };
}

/** O intervalo cobre só meses inteiros (o orçamento é por mês)? */
export function soMesesInteiros(i: Intervalo): boolean {
  return i.de.dia === 1 && i.ate.dia === ultimoDia(i.ate.ano, i.ate.mes);
}

/** A aba e o período da rota, contando com os intervalos. */
export function periodoCompletoDaRota(caminho: string, busca: { get(nome: string): string | null }, agora: Date): { aba: AbaComMes; mes: MesDoPeriodo | null; intervalo: Intervalo | null } | null {
  const intervalo = lerIntervalo({ periodo: busca.get("periodo"), de: busca.get("de"), ate: busca.get("ate") }, agora);
  if (caminho === "/mensal/periodo") return intervalo ? { aba: "transacoes", mes: null, intervalo } : { aba: "transacoes", mes: mesDeAgora(agora), intervalo: null };
  const base = periodoDaRota(caminho, busca.get("mes"), agora);
  if (!base) return null;
  if (intervalo && base.aba !== "transacoes") return { aba: base.aba, mes: null, intervalo };
  return { aba: base.aba, mes: base.mes, intervalo: null };
}
