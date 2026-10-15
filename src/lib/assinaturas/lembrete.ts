import { mesmaAssinatura, type EstadoDaAssinatura, type Evento } from "./regra";

/**
 * O lembrete de cancelar no dia da cobrança (15/10/2026, decisão da Dani: o botão do Raio-X tem de
 * funcionar de verdade, não só trocar o texto).
 *
 * Mora junto da regra única (regra.ts) e segue o mesmo jeito: cada toque vira uma linha na tabela
 * Decisao (tipo "assinatura_lembrete"), identificada pelas mesmas MARCAS da assinatura, e vale a
 * mais recente. "ligar" grava o dia e o valor da cobrança; "desligar" é o Desfazer.
 *
 * O lembrete só vale enquanto a assinatura está "para cancelar" e foi ligado DEPOIS da resposta
 * que a deixou assim: virou "cancelada", "mantida", "fora da lista" ou voltou a "aberta", ele para
 * sozinho. Se ela cancelar de novo depois, é um pedido novo (o botão aparece de novo).
 *
 * Puro, sem banco e sem React. Quem lê e grava é `lembretes.ts`.
 */

export const TIPO_DO_LEMBRETE = "assinatura_lembrete";

export type DadosDoLembrete = {
  marcas: string[];
  em: string;
  /** Dia do mês em que ela costuma cobrar (1 a 31). Nulo: o app não sabe e pergunta. */
  dia: number | null;
  valor: number | null;
  nome: string | null;
  /** A chave do Raio-X (o "Cancelei mesmo" e o selinho usam). */
  raiox: string | null;
};

export type LembreteDeAssinatura = {
  id: string;
  ligado: boolean;
  marcas: string[];
  dia: number | null;
  valor: number | null;
  nome: string | null;
  raiox: string | null;
  em: Date;
};

/** O que o Raio-X mostra na assinatura: o selinho "lembrete dia 12", o "Que dia ela cobra?" (dia nulo) ou o "Cancelou?". */
export type LembreteNaTela = { dia: number | null; perguntar: boolean };

const DIA_MS = 86_400_000;

/** Uma linha da tabela (Decisao "assinatura_lembrete") vira lembrete. */
export function lembreteDaLinha(l: { id: string; descricao: string | null; dados: unknown; createdAt: Date }): LembreteDeAssinatura | null {
  if (l.descricao !== "ligar" && l.descricao !== "desligar") return null;
  const d = (l.dados && typeof l.dados === "object" ? l.dados : {}) as Partial<DadosDoLembrete>;
  if (!Array.isArray(d.marcas)) return null;
  const em = typeof d.em === "string" && !Number.isNaN(Date.parse(d.em)) ? new Date(d.em) : l.createdAt;
  const dia = typeof d.dia === "number" && Number.isInteger(d.dia) && d.dia >= 1 && d.dia <= 31 ? d.dia : null;
  return {
    id: l.id,
    ligado: l.descricao === "ligar",
    marcas: d.marcas.filter((m): m is string => typeof m === "string"),
    dia,
    valor: typeof d.valor === "number" && d.valor > 0 ? d.valor : null,
    nome: typeof d.nome === "string" ? d.nome : null,
    raiox: typeof d.raiox === "string" ? d.raiox : null,
    em,
  };
}

/** A linha mais recente sobre a assinatura (ligar ou desligar). */
export function ultimoLembrete(marcas: readonly string[], lembretes: readonly LembreteDeAssinatura[]): LembreteDeAssinatura | null {
  let ultimo: LembreteDeAssinatura | null = null;
  for (const l of lembretes) {
    if (!mesmaAssinatura(l.marcas, marcas)) continue;
    if (!ultimo || l.em.getTime() > ultimo.em.getTime() || (l.em.getTime() === ultimo.em.getTime() && l.id > ultimo.id)) ultimo = l;
  }
  return ultimo;
}

/**
 * O lembrete que vale agora, ou null. Só "para cancelar", e só se foi ligado depois da resposta que
 * deixou a assinatura assim (`ultima`, de estadoDaAssinatura).
 */
export function lembreteQueVale(
  marcas: readonly string[],
  lembretes: readonly LembreteDeAssinatura[],
  estado: { estado: EstadoDaAssinatura; ultima: Pick<Evento, "em"> | null },
): LembreteDeAssinatura | null {
  if (estado.estado !== "para_cancelar" || !estado.ultima) return null;
  const l = ultimoLembrete(marcas, lembretes);
  if (!l || !l.ligado) return null;
  return l.em.getTime() >= estado.ultima.em.getTime() ? l : null;
}

/* ---------------------------------------------------------------- o dia da cobrança */

/** Uma cobrança da assinatura no histórico: a data do lançamento (sem hora) e o valor. */
export type CobrancaDaAssinatura = { data: Date | null; valor: number; year: number; month: number };

/** Distância entre dois dias do mês numa volta (31 e 1 ficam a 1 dia: a cobrança que escorrega). */
const distancia = (a: number, b: number) => Math.min(Math.abs(a - b), 31 - Math.abs(a - b));
/** Até 3 dias de diferença entre os meses ainda é "o mesmo dia" (fim de semana, feriado, fatura). */
const FOLGA = 3;

/**
 * O dia em que ela costuma cobrar e o valor da cobrança mais recente. Confiável só com pelo menos
 * duas cobranças com data, em meses diferentes, todas a até 3 dias uma da outra. Senão null: a
 * tela pergunta "Que dia ela cobra?" em vez de prometer.
 */
export function diaDaCobranca(cobrancas: readonly CobrancaDaAssinatura[]): { dia: number; valor: number } | null {
  const porMes = new Map<number, CobrancaDaAssinatura & { data: Date }>();
  for (const c of cobrancas) {
    if (!c.data || !(c.valor > 0)) continue;
    const mes = c.data.getUTCFullYear() * 12 + c.data.getUTCMonth();
    const ja = porMes.get(mes);
    if (!ja || c.data.getTime() > ja.data.getTime()) porMes.set(mes, c as CobrancaDaAssinatura & { data: Date });
  }
  const ordem = [...porMes.values()].sort((a, b) => a.data.getTime() - b.data.getTime());
  if (ordem.length < 2) return null;
  const recente = ordem[ordem.length - 1];
  const dia = recente.data.getUTCDate();
  if (ordem.some((c) => distancia(c.data.getUTCDate(), dia) > FOLGA)) return null;
  return { dia, valor: Math.round(recente.valor * 100) / 100 };
}

const diaSemHora = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const ultimoDiaDoMes = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
/** O dia de cobrança naquele mês: 31 vira 30 em novembro, 28 em fevereiro. */
const cobrancaNoMes = (dia: number, ano: number, mes0: number) => new Date(Date.UTC(ano, mes0, Math.min(dia, ultimoDiaDoMes(ano, mes0))));

/** A próxima cobrança a partir de `desde` (o próprio dia conta). */
export function proximaCobranca(dia: number, desde: Date): Date {
  const d = diaSemHora(desde);
  const aqui = cobrancaNoMes(dia, d.getUTCFullYear(), d.getUTCMonth());
  return aqui.getTime() >= d.getTime() ? aqui : cobrancaNoMes(dia, d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** A última cobrança até `ate` (o próprio dia conta). */
export function cobrancaAnterior(dia: number, ate: Date): Date {
  const d = diaSemHora(ate);
  const aqui = cobrancaNoMes(dia, d.getUTCFullYear(), d.getUTCMonth());
  return aqui.getTime() <= d.getTime() ? aqui : cobrancaNoMes(dia, d.getUTCFullYear(), d.getUTCMonth() - 1);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ---------------------------------------------------------------- o que sai hoje */

export type AvisoDoLembrete = {
  /** "vespera": amanhã cobra. "dia": cobra hoje. "pergunta": o dia passou e a cobrança não veio. */
  quando: "vespera" | "dia" | "pergunta";
  /** A cobrança de que se fala. */
  cobranca: Date;
  /**
   * A trava (NotificationLog): uma por ciclo. Véspera e dia têm a MESMA chave, então quem recebeu
   * na véspera não recebe de novo no dia; o dia só sai se a véspera não saiu (ligou tarde, não
   * chegou). A pergunta tem a dela.
   */
  chave: string;
};

/** Depois de quantos dias sem a cobrança aparecer o app pergunta se ela cancelou. */
export const DIAS_PARA_PERGUNTAR = 3;
/** Uma cobrança até 5 dias antes ou depois do dia ainda é a do ciclo. */
const JANELA_DA_COBRANCA = 5;

/**
 * O aviso que o lembrete dá hoje, ou null. `identidade` é a chave da assinatura (chaveDaIdentidade).
 * Para a pergunta: `cobrancas` são as cobranças de verdade da assinatura (sem as cópias que o app
 * lançou adiantado) e `dadosAte` o dia do lançamento mais recente que ela trouxe: sem extrato
 * depois do dia da cobrança, "não apareceu" não quer dizer nada, e o app não pergunta.
 */
export function avisoDeHoje(
  identidade: string,
  l: Pick<LembreteDeAssinatura, "dia" | "em">,
  hoje: Date,
  historico: { cobrancas: readonly CobrancaDaAssinatura[]; dadosAte: Date | null; respondeuAindaNao?: boolean } | null = null,
): AvisoDoLembrete | null {
  if (!l.dia) return null;
  const h = diaSemHora(hoje);
  const proxima = proximaCobranca(l.dia, h);
  const faltam = Math.round((proxima.getTime() - h.getTime()) / DIA_MS);
  if (faltam === 0 || faltam === 1) return { quando: faltam === 0 ? "dia" : "vespera", cobranca: proxima, chave: `assinatura|${identidade}|${iso(proxima)}` };
  if (!historico || historico.respondeuAindaNao) return null;
  const passada = cobrancaAnterior(l.dia, new Date(h.getTime() - DIAS_PARA_PERGUNTAR * DIA_MS));
  // Só o ciclo que veio depois do pedido de lembrete.
  if (passada.getTime() < diaSemHora(l.em).getTime()) return null;
  if (!historico.dadosAte || historico.dadosAte.getTime() <= passada.getTime()) return null;
  const veio = historico.cobrancas.some((c) =>
    c.data
      ? Math.abs(diaSemHora(c.data).getTime() - passada.getTime()) <= JANELA_DA_COBRANCA * DIA_MS
      : c.year === passada.getUTCFullYear() && c.month === passada.getUTCMonth() + 1,
  );
  if (veio) return null;
  return { quando: "pergunta", cobranca: passada, chave: `assinatura|${identidade}|${iso(passada)}|pergunta` };
}

/* ---------------------------------------------------------------- o texto */

/** O texto, na voz do app: curto, sem artigo (não marca gênero da assinatura). */
export function textoDoAviso(quando: AvisoDoLembrete["quando"], nome: string, valor: string | null): { titulo: string; corpo: string } {
  const quanto = valor ? ` ${valor}` : "";
  if (quando === "vespera") return { titulo: `${nome} cobra${quanto} amanhã`, corpo: "Se for cancelar, é hoje." };
  if (quando === "dia") return { titulo: `${nome} cobra${quanto} hoje`, corpo: "Se cancelar agora, a próxima não vem." };
  return { titulo: `${nome} não cobrou este mês`, corpo: "Cancelou? Confirme no Raio-X." };
}
