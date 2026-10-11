import { classifyDividendTax, netValuePerShare } from "@/lib/analysis/dividend-tax";

/**
 * A aba Proventos da Carteira (rodada 16): "ver a renda passiva".
 *
 * Os proventos vêm por TICKER (DividendEvent); o valor dela é o valor por cota × as cotas que
 * ela tem. É uma estimativa com as cotas de HOJE (o app não guarda quantas ela tinha em cada
 * data), e a tela diz isso no "?". JSCP já sai líquido dos 15%; o resto, como foi anunciado.
 */

export type EventoDeProvento = { ticker: string; kind: string; paymentDate: Date; valuePerShare: number };
export type PosicaoParaProventos = { ticker: string; quantidade: number; investido: number | null };

export type ProventoDela = { ticker: string; tipo: string; pagamento: Date; valor: number };

export type MesDeProventos = {
  ano: number;
  /** 1 a 12. */
  mes: number;
  recebido: number;
  aCaminho: number;
};

export type ResumoDosProventos = {
  /** Recebido nos últimos 12 meses (até hoje). */
  dozeMeses: number;
  mediaPorMes: number;
  /** 12 colunas: os 10 meses antes deste, este e o próximo. */
  meses: MesDeProventos[];
  aCaminho: ProventoDela[];
  totalACaminho: number;
  /** Quem mais pagou nos últimos 12 meses, com o rendimento sobre o que ela pagou. */
  ranking: { ticker: string; valor: number; sobreOQuePagou: number | null }[];
  /** Algum provento com tributação que o app não sabe (mostrado bruto). */
  temBruto: boolean;
};

const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** `hoje`: meia-noite UTC do dia de Brasília (brazilTodayUtc), como as datas @db.Date. */
export function resumirProventos(eventos: EventoDeProvento[], posicoes: PosicaoParaProventos[], hoje: Date): ResumoDosProventos {
  const qtd = new Map<string, number>();
  const investido = new Map<string, number>();
  for (const p of posicoes) {
    const t = p.ticker.toUpperCase();
    if (!(p.quantidade > 0)) continue;
    qtd.set(t, (qtd.get(t) ?? 0) + p.quantidade);
    if (p.investido && p.investido > 0) investido.set(t, (investido.get(t) ?? 0) + p.investido);
  }
  const hojeMs = dia(hoje);
  const umAnoAtras = Date.UTC(hoje.getUTCFullYear() - 1, hoje.getUTCMonth(), hoje.getUTCDate());

  const dela: ProventoDela[] = [];
  let temBruto = false;
  for (const e of eventos) {
    const q = qtd.get(e.ticker.toUpperCase());
    if (!q) continue;
    if (classifyDividendTax(e.kind) === "desconhecido") temBruto = true;
    dela.push({ ticker: e.ticker.toUpperCase(), tipo: e.kind, pagamento: e.paymentDate, valor: Math.round(q * netValuePerShare(e.kind, e.valuePerShare) * 100) / 100 });
  }

  const recebidos = dela.filter((p) => dia(p.pagamento) <= hojeMs && dia(p.pagamento) > umAnoAtras);
  const dozeMeses = Math.round(recebidos.reduce((s, p) => s + p.valor, 0) * 100) / 100;

  const meses: MesDeProventos[] = [];
  for (let k = -10; k <= 1; k++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + k, 1));
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const doMes = dela.filter((p) => p.pagamento.getUTCFullYear() === ano && p.pagamento.getUTCMonth() + 1 === mes);
    const soma = (lista: ProventoDela[]) => Math.round(lista.reduce((s, p) => s + p.valor, 0) * 100) / 100;
    meses.push({ ano, mes, recebido: soma(doMes.filter((p) => dia(p.pagamento) <= hojeMs)), aCaminho: soma(doMes.filter((p) => dia(p.pagamento) > hojeMs)) });
  }

  const aCaminho = dela.filter((p) => dia(p.pagamento) > hojeMs).sort((a, b) => a.pagamento.getTime() - b.pagamento.getTime());
  const totalACaminho = Math.round(aCaminho.reduce((s, p) => s + p.valor, 0) * 100) / 100;

  const porTicker = new Map<string, number>();
  for (const p of recebidos) porTicker.set(p.ticker, (porTicker.get(p.ticker) ?? 0) + p.valor);
  const ranking = [...porTicker.entries()]
    .map(([ticker, valor]) => {
      const inv = investido.get(ticker);
      return { ticker, valor: Math.round(valor * 100) / 100, sobreOQuePagou: inv ? valor / inv : null };
    })
    .sort((a, b) => b.valor - a.valor);

  return { dozeMeses, mediaPorMes: Math.round((dozeMeses / 12) * 100) / 100, meses, aCaminho, totalACaminho, ranking, temBruto };
}

/**
 * "Sua renda passiva já paga a Netflix": as contas que cabem na média de proventos por mês, das
 * mais caras para as mais baratas. Só contas com valor certo (as que variam não entram).
 */
export function contasQueOsProventosPagam<T extends { nome: string; valor: number }>(media: number, contas: T[]): T[] {
  if (!(media > 0)) return [];
  const pagas: T[] = [];
  let soma = 0;
  for (const c of [...contas].filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor)) {
    if (soma + c.valor <= media) {
      pagas.push(c);
      soma += c.valor;
    }
    if (pagas.length === 3) break;
  }
  return pagas;
}
