import type { ParentCategory } from "@prisma/client";
import { chaveDoMes, ehMaquininha, ehVenda, mesAntes, nomeDaSaida, reciboDoMes, tipoDaSaida, type LancamentoDaEmpresa, type Mes, type Recibo } from "./regras";

/**
 * O período das telas da Empresa (13/10/2026). A dona pediu: "quero filtrar por data também, não só
 * o mês fechado. Eu quero ver no ano quanto eu ganhei." Antes, a Visão geral, o "Como vai" e os
 * Relatórios só mostravam um mês. Agora: Este mês, Mês passado, Este ano, Últimos 12 meses e
 * Escolher datas (de/até). Puro, sem banco e sem React; quem chama passa o "hoje" de Brasília.
 *
 * Que lançamento entra (a mesma regra para as somas e para a lista editável):
 * - O mês que manda é o do lançamento (year/month), como no recibo do mês. Mês inteiro dentro do
 *   período: tudo dele entra, com ou sem dia. Assim "Este ano" é a soma exata dos recibos de cada mês.
 * - Mês cortado no meio (só no Escolher datas, ou no mês de hoje): entra pelo dia do lançamento.
 *   Lançamento sem dia usa o mês: vale como dia 1 dele.
 *
 * Fechamento: "fechado" na Empresa é só o mês que já acabou. Nada trava a edição: os lançamentos
 * de qualquer mês abrem a folha de editar de sempre (o fechamento do Resumo do Pessoal,
 * FechamentoDoMes, também não trava; ver lib/repositories/fechamento.repo.ts).
 */

export type TipoDoPeriodo = "mes" | "mes-passado" | "ano" | "12m" | "datas";
/** `de` e `ate` em "AAAA-MM-DD", os dois dias dentro. */
export type PeriodoDaEmpresa = {
  tipo: TipoDoPeriodo;
  de: string;
  ate: string;
  /**
   * Vai até hoje: o mês de hoje conta inteiro, como no recibo do mês (o lançamento com data mais
   * para a frente neste mês, como a conta agendada, não some do "Este mês").
   */
  aberto?: true;
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ord = (m: Mes) => m.ano * 12 + (m.mes - 1);
const doTexto = (d: string): Mes => ({ ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) });
export const ultimoDiaDoMes = (m: Mes) => new Date(Date.UTC(m.ano, m.mes, 0)).getUTCDate();
const dia = (m: Mes, d: number) => `${chaveDoMes(m)}-${String(d).padStart(2, "0")}`;
export const primeiroDia = (m: Mes) => dia(m, 1);
export const ultimoDia = (m: Mes) => dia(m, ultimoDiaDoMes(m));

/** O período de cada chip, contado a partir de hoje (nunca passa de hoje). */
export function periodoDoTipo(tipo: Exclude<TipoDoPeriodo, "datas">, hoje: string): PeriodoDaEmpresa {
  const atual = doTexto(hoje);
  if (tipo === "mes") return { tipo, de: primeiroDia(atual), ate: hoje, aberto: true };
  if (tipo === "mes-passado") {
    const m = mesAntes(atual, 1);
    return { tipo, de: primeiroDia(m), ate: ultimoDia(m) };
  }
  if (tipo === "ano") return { tipo, de: `${atual.ano}-01-01`, ate: hoje, aberto: true };
  // Últimos 12 meses: os 11 meses antes deste e este, até hoje.
  return { tipo, de: primeiroDia(mesAntes(atual, 11)), ate: hoje, aberto: true };
}

function lerDia(texto: string | null | undefined): string | null {
  const x = typeof texto === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto) : null;
  if (!x) return null;
  const m = { ano: Number(x[1]), mes: Number(x[2]) };
  if (m.ano < 2000 || m.mes < 1 || m.mes > 12 || Number(x[3]) < 1 || Number(x[3]) > ultimoDiaDoMes(m)) return null;
  return texto as string;
}

const TIPOS: readonly string[] = ["mes", "mes-passado", "ano", "12m"];

/**
 * Lê ?periodo=mes|mes-passado|ano|12m ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD. Nada válido: nulo (cada
 * tela fica no que mostrava antes). Datas trocadas se desviram; o futuro vira hoje.
 */
export function lerPeriodo(p: { periodo?: string | null; de?: string | null; ate?: string | null }, hoje: string): PeriodoDaEmpresa | null {
  if (p.periodo && TIPOS.includes(p.periodo)) return periodoDoTipo(p.periodo as Exclude<TipoDoPeriodo, "datas">, hoje);
  let de = lerDia(p.de);
  let ate = lerDia(p.ate ?? p.de);
  if (!de || !ate) return null;
  if (ate < de) [de, ate] = [ate, de];
  if (de > hoje) return null;
  if (ate >= hoje) return { tipo: "datas", de, ate: hoje, aberto: true };
  return { tipo: "datas", de, ate };
}

/** O que vai no endereço (para voltar e compartilhar). */
export function parametrosDoPeriodo(p: PeriodoDaEmpresa): string {
  return p.tipo === "datas" ? `de=${p.de}&ate=${p.ate}` : `periodo=${p.tipo}`;
}

/** Os meses que o período toca, do mais antigo ao mais novo. */
export function mesesDoPeriodo(p: PeriodoDaEmpresa): Mes[] {
  const a = doTexto(p.de);
  const b = doTexto(p.ate);
  return Array.from({ length: Math.max(0, ord(b) - ord(a) + 1) }, (_, i) => mesAntes(a, -i));
}

/** O período é um mês só, inteiro (ou o mês de hoje até hoje)? Devolve o mês. */
export function umMesSo(p: PeriodoDaEmpresa, hoje: string): Mes | null {
  const m = doTexto(p.de);
  if (p.de !== primeiroDia(m) || chaveDoMes(doTexto(p.ate)) !== chaveDoMes(m)) return null;
  return p.ate === ultimoDia(m) || p.ate === hoje ? m : null;
}

/** O período é um ano inteiro (ou este ano até hoje)? Devolve o ano. */
export function anoSo(p: PeriodoDaEmpresa, hoje: string): number | null {
  const ano = Number(p.de.slice(0, 4));
  if (p.de !== `${ano}-01-01`) return null;
  return p.ate === `${ano}-12-31` || (p.ate === hoje && hoje.startsWith(`${ano}-`)) ? ano : null;
}

const faixa = (de: string, ate: string) => {
  const a = doTexto(de);
  const b = doTexto(ate);
  const d1 = Number(de.slice(8));
  const d2 = Number(ate.slice(8));
  if (a.ano === b.ano && a.mes === b.mes) return d1 === d2 ? `${d1} ${CURTO[a.mes - 1]} ${a.ano}` : `${d1} a ${d2} ${CURTO[a.mes - 1]} ${a.ano}`;
  if (a.ano === b.ano) return `${d1} ${CURTO[a.mes - 1]} a ${d2} ${CURTO[b.mes - 1]} ${b.ano}`;
  return `${d1} ${CURTO[a.mes - 1]} ${a.ano} a ${d2} ${CURTO[b.mes - 1]} ${b.ano}`;
};

/** O nome do chip e a linha de baixo: "Este ano · jan a out 2026", "Mês passado · set 2026", "Março · 2026". */
export function rotuloDoPeriodo(p: PeriodoDaEmpresa, hoje: string): { nome: string; sub: string } {
  const atual = doTexto(hoje);
  const a = doTexto(p.de);
  const b = doTexto(p.ate);
  const m = umMesSo(p, hoje);
  if (m) {
    if (ord(m) === ord(atual)) return { nome: "Este mês", sub: `até ${Number(hoje.slice(8))} ${CURTO[m.mes - 1]}` };
    if (ord(m) === ord(atual) - 1) return { nome: "Mês passado", sub: `${CURTO[m.mes - 1]} ${m.ano}` };
    return { nome: cap(MESES[m.mes - 1]), sub: String(m.ano) };
  }
  const ano = anoSo(p, hoje);
  if (ano !== null) return ano === atual.ano ? { nome: "Este ano", sub: `jan a ${CURTO[b.mes - 1]} ${ano}` } : { nome: String(ano), sub: "o ano inteiro" };
  if (p.tipo === "12m") return { nome: "Últimos 12 meses", sub: `${CURTO[a.mes - 1]} ${a.ano} a ${CURTO[b.mes - 1]} ${b.ano}` };
  // Meses inteiros: "mar a jun 2026"; senão, os dias.
  if (p.de === primeiroDia(a) && (p.ate === ultimoDia(b) || p.ate === hoje)) {
    return { nome: a.ano === b.ano ? `${cap(CURTO[a.mes - 1])} a ${CURTO[b.mes - 1]}` : `${cap(CURTO[a.mes - 1])} ${a.ano} a ${CURTO[b.mes - 1]}`, sub: String(b.ano) };
  }
  return { nome: faixa(p.de, p.ate), sub: "datas escolhidas" };
}

/** Como o período entra numa frase: "em 2026", "em setembro", "nos últimos 12 meses", "no período". */
export function noPeriodoTexto(p: PeriodoDaEmpresa, hoje: string): string {
  const m = umMesSo(p, hoje);
  if (m) return `em ${MESES[m.mes - 1]}`;
  const ano = anoSo(p, hoje);
  if (ano !== null) return `em ${ano}`;
  if (p.tipo === "12m") return "nos últimos 12 meses";
  return "no período";
}

/** O lançamento entra no período? (a regra do cabeçalho). */
export function dentroDoPeriodo(l: Pick<LancamentoDaEmpresa, "year" | "month" | "entryDate">, p: PeriodoDaEmpresa): boolean {
  const m = { ano: l.year, mes: l.month };
  const ini = primeiroDia(m);
  const fim = ultimoDia(m);
  const ate = p.aberto ? ultimoDia(doTexto(p.ate)) : p.ate;
  if (fim < p.de || ini > ate) return false;
  if (ini >= p.de && fim <= ate) return true;
  // Mês cortado no meio: o dia do lançamento manda; sem dia, vale o dia 1 do mês dele.
  const d = l.entryDate ?? ini;
  return d >= p.de && d <= ate;
}

export function lancamentosDoPeriodo<L extends Pick<LancamentoDaEmpresa, "year" | "month" | "entryDate">>(lancamentos: L[], p: PeriodoDaEmpresa): L[] {
  return lancamentos.filter((l) => dentroDoPeriodo(l, p));
}

// ─── Grupos: o que cada total soma (tocar num total abre exatamente estes lançamentos) ──────

/**
 * entradas = faturamento; variaveis = insumos e entregas; fixas = contas do mês; lucro = o que
 * entra no "Sobrou" (vendas e despesas); cat:<categoria>; cliente:<nome> (vazio = vendas sem nome);
 * saida:<nome> = a linha do "Para onde foi" (só o que sobe com a venda, sem a maquininha).
 */
export type Grupo = "entradas" | "despesas" | "variaveis" | "fixas" | "lucro" | "prolabore" | "impostos" | `cat:${string}` | `cliente:${string}` | `saida:${string}`;

const GRUPOS_FIXOS: readonly string[] = ["entradas", "despesas", "variaveis", "fixas", "lucro", "prolabore", "impostos"];

export function lerGrupo(texto: string | null | undefined): Grupo | null {
  if (!texto) return null;
  if (GRUPOS_FIXOS.includes(texto)) return texto as Grupo;
  if (/^cat:[A-Za-z0-9_-]{1,64}$/.test(texto)) return texto as Grupo;
  if ((texto.startsWith("cliente:") || texto.startsWith("saida:")) && texto.length <= 128) return texto as Grupo;
  return null;
}

/** A categoria da Empresa de uma despesa: a personalizada manda; senão a categoria-mãe; sem nenhuma, OUTROS. */
export const chaveDaCategoria = (l: Pick<LancamentoDaEmpresa, "customCategoryId" | "parentCategory">) => l.customCategoryId ?? l.parentCategory ?? "OUTROS";

/** Despesa da empresa: insumos, contas e impostos (sem o pró-labore, aplicação ou fatura). */
const ehDespesa = (l: LancamentoDaEmpresa) => {
  const t = tipoDaSaida(l);
  return t === "variavel" || t === "fixa" || t === "imposto";
};

const nomeDoCliente = (l: LancamentoDaEmpresa) => l.cliente?.trim().toLocaleLowerCase("pt-BR") ?? "";

export function noGrupo(l: LancamentoDaEmpresa, g: Grupo): boolean {
  if (g === "entradas") return ehVenda(l);
  if (g === "despesas") return ehDespesa(l);
  if (g === "variaveis") return tipoDaSaida(l) === "variavel";
  if (g === "fixas") return tipoDaSaida(l) === "fixa";
  if (g === "lucro") return ehVenda(l) || ehDespesa(l);
  if (g === "prolabore") return tipoDaSaida(l) === "salario";
  if (g === "impostos") return tipoDaSaida(l) === "imposto";
  if (g.startsWith("cat:")) return ehDespesa(l) && chaveDaCategoria(l) === g.slice(4);
  if (g.startsWith("saida:")) return tipoDaSaida(l) === "variavel" && !ehMaquininha(l) && nomeDaSaida(l) === g.slice(6);
  return ehVenda(l) && nomeDoCliente(l) === g.slice(8).trim().toLocaleLowerCase("pt-BR");
}

// ─── As somas do período ───────────────────────────────────────────────────────────────────

export type MesDoPeriodo = { m: Mes; entrou: number; saiu: number; sobrou: number; parcial: boolean };
export type ClienteDoPeriodo = { nome: string; valor: number; n: number };
export type CategoriaDoPeriodo = { chave: string; parent: ParentCategory | null; custom: string | null; valor: number; n: number };

export type ResumoDoPeriodo = {
  /** O recibo do período inteiro (a soma dos recibos de cada mês, cortados pelo período). */
  recibo: Recibo;
  /** Insumos, contas e impostos. */
  despesas: number;
  /** O pró-labore lançado no período. */
  proLabore: number;
  /** O que ficou na empresa depois do pró-labore. */
  ficou: number;
  meses: MesDoPeriodo[];
  /** Os maiores clientes com nome (do maior para o menor) e as vendas sem nome. */
  clientes: ClienteDoPeriodo[];
  semNome: { valor: number; n: number };
  /** As despesas por categoria da Empresa, da maior para a menor. */
  categorias: CategoriaDoPeriodo[];
  nLancamentos: number;
};

const c2 = (v: number) => Math.round(v * 100) / 100;

const SOMAVEIS = ["entrou", "nVendas", "variaveis", "fixas", "impostos", "sobrou", "salarioLancado", "maquininha"] as const;

/** Tudo que as telas mostram para um período, a partir dos lançamentos (de qualquer janela). */
export function resumoDoPeriodo(lancamentos: LancamentoDaEmpresa[], p: PeriodoDaEmpresa, hoje: string): ResumoDoPeriodo {
  const dentro = lancamentosDoPeriodo(lancamentos, p);
  const atual = doTexto(hoje);
  const recibo: Recibo = { entrou: 0, nVendas: 0, variaveis: 0, fixas: 0, impostos: 0, sobrou: 0, salarioLancado: 0, maquininha: 0, porForma: {} };
  const meses: MesDoPeriodo[] = [];
  for (const m of mesesDoPeriodo(p)) {
    const r = reciboDoMes(dentro, m);
    for (const k of SOMAVEIS) recibo[k] += r[k];
    for (const [f, v] of Object.entries(r.porForma)) recibo.porForma[f as keyof Recibo["porForma"]] = c2((recibo.porForma[f as keyof Recibo["porForma"]] ?? 0) + (v ?? 0));
    const ultimo = ultimoDia(m);
    meses.push({ m, entrou: r.entrou, saiu: c2(r.variaveis + r.fixas + r.impostos), sobrou: r.sobrou, parcial: ord(m) === ord(atual) || p.ate < ultimo || p.de > primeiroDia(m) });
  }
  for (const k of SOMAVEIS) recibo[k] = k === "nVendas" ? recibo[k] : c2(recibo[k]);

  const porCliente = new Map<string, ClienteDoPeriodo>();
  const semNome = { valor: 0, n: 0 };
  const porCategoria = new Map<string, CategoriaDoPeriodo>();
  for (const l of dentro) {
    if (ehVenda(l)) {
      const nome = l.cliente?.trim();
      if (!nome) {
        semNome.valor += l.amount;
        semNome.n += 1;
        continue;
      }
      const k = nome.toLocaleLowerCase("pt-BR");
      const c = porCliente.get(k) ?? { nome, valor: 0, n: 0 };
      c.valor += l.amount;
      c.n += 1;
      porCliente.set(k, c);
    } else if (ehDespesa(l)) {
      const chave = chaveDaCategoria(l);
      const c = porCategoria.get(chave) ?? { chave, parent: l.customCategoryId ? null : (l.parentCategory ?? "OUTROS"), custom: l.customCategoryId ?? null, valor: 0, n: 0 };
      c.valor += l.amount;
      c.n += 1;
      porCategoria.set(chave, c);
    }
  }
  const despesas = c2(recibo.variaveis + recibo.fixas + recibo.impostos);
  return {
    recibo,
    despesas,
    proLabore: recibo.salarioLancado,
    ficou: c2(recibo.sobrou - recibo.salarioLancado),
    meses,
    clientes: [...porCliente.values()].map((c) => ({ ...c, valor: c2(c.valor) })).sort((a, b) => b.valor - a.valor),
    semNome: { valor: c2(semNome.valor), n: semNome.n },
    categorias: [...porCategoria.values()].map((c) => ({ ...c, valor: c2(c.valor) })).filter((c) => c.valor !== 0).sort((a, b) => b.valor - a.valor),
    nLancamentos: dentro.length,
  };
}

/** O primeiro mês que o período precisa ler do banco (para buscar além da janela de 12 meses). */
export const primeiroMesDoPeriodo = (p: PeriodoDaEmpresa): Mes => doTexto(p.de);

/** Os atalhos do Escolher datas: os meses de um ano (só os que já começaram) e os anos (até 5). */
export function atalhosDeDatas(hoje: string, anoVisto: number): { meses: { m: Mes; de: string; ate: string; futuro: boolean }[]; anos: number[] } {
  const atual = doTexto(hoje);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = { ano: anoVisto, mes: i + 1 };
    const futuro = ord(m) > ord(atual);
    return { m, de: primeiroDia(m), ate: ultimoDia(m), futuro };
  });
  return { meses, anos: Array.from({ length: 5 }, (_, i) => atual.ano - i) };
}
