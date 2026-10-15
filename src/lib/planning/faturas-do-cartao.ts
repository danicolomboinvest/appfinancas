import {
  cicloAberto,
  diasValidos,
  faturaDoLancamento,
  faturaQueVenceEm,
  faturaSeguinte,
  isoDoDia,
  melhorDiaParaComprar,
  somarMesesAoMes,
  type Dia,
  type Fatura,
} from "@/lib/cartao/fatura";

/**
 * As faturas de um cartão cadastrado (15/10/2026): a fonte única do total de cada fatura. A tela
 * "Seu cartão" e a jornada leem daqui, e o total é SEMPRE a soma dos lançamentos ligados ao
 * cartão (MonthlyEntry.cartaoId) que caem naquela fatura pela regra de lib/cartao/fatura.ts.
 * Estorno é gasto negativo e desconta sozinho.
 *
 * Isto não mexe no mês que conta no orçamento: o lançamento continua no year/month dele. A fatura
 * é só outra forma de agrupar os mesmos lançamentos.
 */

export type CartaoComDias = { id: string; banco: string; apelido: string | null; diaFechamento: number | null; diaVencimento: number | null };

export type LancamentoDoCartao = {
  id: string;
  year: number;
  month: number;
  entryDate: Date | string | null;
  amount: number;
  description: string | null;
};

export type FaturaComTotal = Fatura & { total: number; lancamentos: LancamentoDoCartao[] };

export type FaturasDoCartao = {
  /** A fatura que recebe a compra de hoje. */
  aberta: FaturaComTotal;
  /** A que vem depois da aberta (as parcelas que já caem nela). */
  proxima: FaturaComTotal;
  /** A que já fechou e ainda não venceu (a que ela tem para pagar), quando há. */
  fechada: FaturaComTotal | null;
  /** O dia do fechamento: comprar nele joga a compra para a fatura seguinte. */
  melhorDia: number;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Os lançamentos de cada fatura, pela chave "AAAA-MM" do vencimento. */
export function agruparPorFatura(cartao: Pick<CartaoComDias, "diaFechamento" | "diaVencimento">, lancamentos: LancamentoDoCartao[]): Map<string, LancamentoDoCartao[]> {
  const porChave = new Map<string, LancamentoDoCartao[]>();
  for (const l of lancamentos) {
    const { chave } = faturaDoLancamento(l, cartao);
    porChave.set(chave, [...(porChave.get(chave) ?? []), l]);
  }
  return porChave;
}

/** O total de uma fatura: a soma dos lançamentos ligados que caem nela. */
export function totalDaFatura(cartao: Pick<CartaoComDias, "diaFechamento" | "diaVencimento">, lancamentos: LancamentoDoCartao[], chave: string): number {
  return centavos((agruparPorFatura(cartao, lancamentos).get(chave) ?? []).reduce((s, l) => s + l.amount, 0));
}

const comDataDesc = (a: LancamentoDoCartao, b: LancamentoDoCartao) => {
  const da = a.entryDate ? (typeof a.entryDate === "string" ? a.entryDate : a.entryDate.toISOString()) : "";
  const db = b.entryDate ? (typeof b.entryDate === "string" ? b.entryDate : b.entryDate.toISOString()) : "";
  return db.localeCompare(da);
};

/** Aberta, próxima e a fechada a pagar, cada uma com o total e os lançamentos. Null sem os dias. */
export function faturasDoCartao(cartao: CartaoComDias, lancamentos: LancamentoDoCartao[], hoje: Dia): FaturasDoCartao | null {
  if (!diasValidos(cartao)) return null;
  const grupos = agruparPorFatura(cartao, lancamentos);
  const montar = (f: Fatura): FaturaComTotal => {
    const doGrupo = [...(grupos.get(f.chave) ?? [])].sort(comDataDesc);
    return { ...f, total: centavos(doGrupo.reduce((s, l) => s + l.amount, 0)), lancamentos: doGrupo };
  };
  const { fatura } = cicloAberto(hoje, cartao);
  const m = somarMesesAoMes(fatura.ano, fatura.mes, -1);
  const anterior = faturaQueVenceEm(m.ano, m.mes, cartao);
  const fechadaAPagar = isoDoDia(anterior.vencimento) >= isoDoDia(hoje) ? montar(anterior) : null;
  return { aberta: montar(fatura), proxima: montar(faturaSeguinte(fatura, cartao)), fechada: fechadaAPagar, melhorDia: melhorDiaParaComprar(cartao) };
}
