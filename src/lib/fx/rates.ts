import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/money";

export type ExchangeRate = {
  from: CurrencyCode;
  to: CurrencyCode;
  /** Quanto vale 1 unidade de `from` em `to` (1 € = 5,91 R$). */
  rate: number;
  /** "2026-09-16", dia da cotação na fonte. */
  date: string;
};

/**
 * Cotação de moeda pra quem lança em outra moeda (salário em euro num app em real).
 *
 * A fonte é a AwesomeAPI (economia.awesomeapi.com.br), brasileira, sem chave, que publica os
 * pares com o real nos dois sentidos. É cotação comercial de referência: o banco da pessoa vai
 * fechar um pouco diferente, e por isso o número volta pro formulário EDITÁVEL — a cotação é
 * sugestão, o que vale é o que ela confirma.
 */
const SOURCE = "https://economia.awesomeapi.com.br/last";

/** Um par (`EURBRL`) → cotação, como a fonte devolve. */
type AwesomePayload = Record<string, { bid?: string; ask?: string; create_date?: string }>;

/** Lê o pacote da fonte: média entre compra e venda, com 4 casas, e o dia da cotação. */
export function parseAwesomeRate(payload: unknown, from: CurrencyCode, to: CurrencyCode): ExchangeRate | null {
  if (!payload || typeof payload !== "object") return null;
  const pair = (payload as AwesomePayload)[`${from}${to}`];
  if (!pair) return null;
  const bid = Number(pair.bid);
  const ask = Number(pair.ask);
  const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : Number.isFinite(bid) ? bid : ask;
  if (!Number.isFinite(mid) || mid <= 0) return null;
  const date = (pair.create_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  return { from, to, rate: Number(mid.toFixed(4)), date };
}

/** Converte um valor pela cotação, já arredondado a centavos. */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRate | null> {
  if (from === to) return { from, to, rate: 1, date: new Date().toISOString().slice(0, 10) };
  try {
    // Uma hora de cache no servidor: a cotação não precisa ser de segundo em segundo, e assim
    // cem pessoas abrindo o formulário na mesma hora fazem uma chamada só na fonte.
    const res = await fetch(`${SOURCE}/${from}-${to}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return parseAwesomeRate(await res.json(), from, to);
  } catch {
    return null;
  }
}

export function toCurrencyOrNull(value: unknown): CurrencyCode | null {
  return typeof value === "string" && isCurrencyCode(value) ? value : null;
}

export { CURRENCY_CODES };
