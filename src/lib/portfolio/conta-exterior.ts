/**
 * Conta no exterior (07/10/2026). A Dani: "às vezes a pessoa vai ter investimentos em dólar, pela
 * Avenue… conta Brasil e conta internacional, para ela poder ver o patrimônio dela lá fora".
 *
 * Regra que segura o resto do app: currentValue/investedValue/currentUnitPrice do ativo continuam
 * SEMPRE na moeda do app (reais). Total, metas, reserva, estratégia e Visão Geral somam esses
 * campos e não precisam saber de câmbio. O ativo de fora guarda também o valor em US$
 * (nativeCurrentValue/nativeInvestedValue) e o câmbio usado (exchangeRate); a cotação da noite
 * refaz a conta em reais com o dólar do dia.
 */

/**
 * A moeda da conta Brasil. É a moeda em que o ATIVO está (onde é negociado), não a moeda do app:
 * quem usa o app em euro continua com PETR4 na conta Brasil.
 */
export const CONTA_BRASIL = "BRL" as const;
/** As contas que o formulário oferece: Brasil ou exterior em dólar. */
export type MoedaDaConta = typeof CONTA_BRASIL | "USD";

/** Conta Brasil é "BRL"; qualquer outra moeda é conta no exterior. */
export function ehDoExterior(currency: string | null | undefined): boolean {
  return Boolean(currency) && currency !== CONTA_BRASIL;
}

/** Ticker de bolsa americana: VOO, AAPL, BRK.B. Nunca casa com B3 (PETR4 tem número). */
export const TICKER_EUA = /^[A-Z]{1,5}(\.[A-Z])?$/;

const centavos = (v: number) => Math.round(v * 100) / 100;

/** US$ → moeda do app, em centavos. */
export function naMoedaDoApp(nativo: number, cambio: number): number {
  return centavos(nativo * cambio);
}

export type PosicaoNoExterior = {
  currentValue: number;
  nativeCurrentValue: number | null;
  nativeInvestedValue: number | null;
  exchangeRate: number | null;
};

/** O câmbio do ativo: o gravado, ou o que sai de reais ÷ dólares. Null se não dá pra saber. */
export function cambioDoAtivo(a: PosicaoNoExterior): number | null {
  if (a.exchangeRate && a.exchangeRate > 0) return a.exchangeRate;
  if (a.nativeCurrentValue && a.nativeCurrentValue > 0 && a.currentValue > 0) return a.currentValue / a.nativeCurrentValue;
  return null;
}

/**
 * O lado em dólar depois de um aporte. O aporte chega em reais (é um lançamento do mês) e o lado
 * em reais já cresce por assetAfterContribution; aqui o mesmo dinheiro entra em US$ pelo câmbio do
 * ativo. Ativo sem lado em dólar (conta Brasil) devolve null: não há o que acompanhar.
 */
export function nativoAposAporte(a: PosicaoNoExterior, valorNaMoedaDoApp: number): { nativeCurrentValue: number; nativeInvestedValue: number | null } | null {
  const cambio = cambioDoAtivo(a);
  if (a.nativeCurrentValue === null || !cambio) return null;
  const emDolar = valorNaMoedaDoApp / cambio;
  return {
    nativeCurrentValue: centavos(a.nativeCurrentValue + emDolar),
    nativeInvestedValue: a.nativeInvestedValue === null ? null : centavos(a.nativeInvestedValue + emDolar),
  };
}

/** O lado em dólar depois de um resgate que levou `fracao` do ativo (mesma regra do lado em reais). */
export function nativoAposResgate(a: PosicaoNoExterior, fracao: number): { nativeCurrentValue: number; nativeInvestedValue: number | null } | null {
  if (a.nativeCurrentValue === null) return null;
  const fica = 1 - Math.min(1, Math.max(0, fracao));
  return {
    nativeCurrentValue: Math.max(0, centavos(a.nativeCurrentValue * fica)),
    nativeInvestedValue: a.nativeInvestedValue === null ? null : Math.max(0, centavos(a.nativeInvestedValue * fica)),
  };
}

/**
 * O que gravar num ativo do exterior na atualização de cotação (botão ou a da noite).
 *
 * Com quantidade e cotação em US$: valor em US$ = quantidade × cotação, e o preço unitário vai em
 * reais (o aporte usa ele pra estimar as cotas novas). Sem cotação, só o dólar do dia muda: o valor
 * em US$ fica e o valor em reais acompanha o câmbio. Sem câmbio, nada muda (null): gravar dólar
 * como se fosse real seria pior que um valor de ontem.
 */
export function atualizacaoDoExterior(input: {
  quantity: number | null;
  nativeCurrentValue: number | null;
  precoNativo: number | null;
  cambio: number | null;
}): { currentValue: number; nativeCurrentValue: number; exchangeRate: number; currentUnitPrice?: number } | null {
  const { quantity, precoNativo, cambio } = input;
  if (!cambio || !Number.isFinite(cambio) || cambio <= 0) return null;
  if (quantity && quantity > 0 && precoNativo && precoNativo > 0) {
    const nativo = centavos(quantity * precoNativo);
    return {
      nativeCurrentValue: nativo,
      currentValue: naMoedaDoApp(nativo, cambio),
      exchangeRate: cambio,
      // 6 casas: a escala da coluna do preço unitário.
      currentUnitPrice: Math.round(precoNativo * cambio * 1e6) / 1e6,
    };
  }
  if (input.nativeCurrentValue === null) return null;
  return { nativeCurrentValue: input.nativeCurrentValue, currentValue: naMoedaDoApp(input.nativeCurrentValue, cambio), exchangeRate: cambio };
}

export type TotaisPorConta = {
  /** Soma da conta Brasil, na moeda do app. */
  brasil: number;
  /** Soma da conta no exterior, na moeda do app (já convertida). */
  exterior: number;
  /** A conta no exterior na moeda dela (US$), quando todos os ativos de fora estão na mesma moeda. */
  exteriorNativo: { moeda: string; valor: number } | null;
  quantosNoExterior: number;
};

/** Brasil × exterior, para os dois quadrados da Carteira. */
export function totaisPorConta(ativos: { currency: string; currentValue: number; nativeCurrentValue: number | null }[]): TotaisPorConta {
  let brasil = 0;
  let exterior = 0;
  let nativo = 0;
  const moedas = new Set<string>();
  let semNativo = false;
  let quantos = 0;
  for (const a of ativos) {
    if (!ehDoExterior(a.currency)) {
      brasil += a.currentValue;
      continue;
    }
    quantos += 1;
    exterior += a.currentValue;
    moedas.add(a.currency);
    if (a.nativeCurrentValue === null) semNativo = true;
    else nativo += a.nativeCurrentValue;
  }
  return {
    brasil: centavos(brasil),
    exterior: centavos(exterior),
    exteriorNativo: quantos > 0 && moedas.size === 1 && !semNativo ? { moeda: [...moedas][0], valor: centavos(nativo) } : null,
    quantosNoExterior: quantos,
  };
}
