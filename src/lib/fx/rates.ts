import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/money";

export type ExchangeRate = {
  from: CurrencyCode;
  to: CurrencyCode;
  /** Quanto vale 1 unidade de `from` em `to` (1 € = 5,91 R$). */
  rate: number;
  /** "2026-09-16", dia da cotação na fonte. */
  date: string;
  /**
   * true = é a última cotação que conseguimos, não a de hoje: a fonte não respondeu agora.
   * A tela precisa disso pra não chamar de "cotação de hoje" um número de ontem.
   */
  stale?: boolean;
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

/** Teto de espera. Sem isto, um fetch pendurado trava o formulário da pessoa até a plataforma matar. */
const TIMEOUT_MS = 4000;

/** Quanto tempo a cotação vale antes de buscar de novo. Câmbio não muda de segundo em segundo. */
const VALIDADE_MS = 60 * 60 * 1000;

/**
 * Cache em memória do processo, por par de moedas.
 *
 * Antes o cache era o `next: { revalidate }` do fetch — e era exatamente ele que quebrava a
 * cotação em produção enquanto funcionava no Mac. A raspagem de cotação de AÇÃO usa fetch puro
 * e funciona na Vercel; esta usava a opção de cache do framework e voltava nula. Guardar aqui
 * não depende de nada do ambiente.
 *
 * Guarda o valor mesmo depois de vencido: cotação de ontem vale muito mais que nenhuma, desde
 * que a tela diga que é de ontem (é o que `stale` faz).
 */
const memoria = new Map<string, { valor: ExchangeRate; buscadoEm: number }>();

/** Yahoo (USDBRL=X): preço do mercado agora, em `to`. */
export function parseYahooFxRate(payload: unknown, from: CurrencyCode, to: CurrencyCode): ExchangeRate | null {
  const meta = (payload as { chart?: { result?: { meta?: { currency?: string; regularMarketPrice?: number; regularMarketTime?: number } }[] | null } })?.chart?.result?.[0]?.meta;
  if (!meta || meta.currency !== to) return null;
  const rate = Number(meta.regularMarketPrice);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const date = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return { from, to, rate: Number(rate.toFixed(4)), date };
}

/** Frankfurter e ExchangeRate-API respondem no mesmo formato: { rates: { BRL: 5.0061 } }. */
export function parseRatesTable(payload: unknown, from: CurrencyCode, to: CurrencyCode): ExchangeRate | null {
  const p = payload as { rates?: Record<string, number>; date?: string; time_last_update_unix?: number };
  const rate = Number(p?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const date = p.date ?? (p.time_last_update_unix ? new Date(p.time_last_update_unix * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  return { from, to, rate: Number(rate.toFixed(4)), date };
}

/** Uma fonte: busca com teto de tempo e lê; null (com o motivo no log) se não deu. */
async function deUmaFonte(nome: string, url: string, ler: (json: unknown) => ExchangeRate | null): Promise<ExchangeRate | null> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controle.signal, cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (compatible; SPIFinance/1.0)" } });
    if (!res.ok) {
      // Erro registrado, nunca engolido: o `catch {}` vazio que existia aqui é a razão de
      // ninguém ter conseguido descobrir por que a cotação não vinha em produção.
      console.error("[fx] fonte respondeu", res.status, nome);
      return null;
    }
    const valor = ler(await res.json());
    if (!valor) console.error("[fx] resposta sem o par esperado", nome);
    return valor;
  } catch (err) {
    const motivo = err instanceof Error ? err.name : "erro";
    console.error("[fx] falha ao buscar", nome, motivo === "AbortError" ? `sem resposta em ${TIMEOUT_MS}ms` : motivo);
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * A cotação do par, tentando as fontes em ordem. A AwesomeAPI responde 429 (pedidos demais) aos
 * servidores da Vercel, que dividem o mesmo endereço com muita gente (07/10/2026): a cotação do
 * lançamento em euro e a do ativo em dólar ficavam vazias em produção. As reservas: o Yahoo
 * (preço de agora), o Frankfurter (taxa do Banco Central Europeu do dia) e a ExchangeRate-API.
 */
export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRate | null> {
  if (from === to) return { from, to, rate: 1, date: new Date().toISOString().slice(0, 10) };

  const chave = `${from}${to}`;
  const guardada = memoria.get(chave);
  if (guardada && Date.now() - guardada.buscadoEm < VALIDADE_MS) return guardada.valor;

  const valor =
    (await deUmaFonte(`awesome ${chave}`, `${SOURCE}/${from}-${to}`, (j) => parseAwesomeRate(j, from, to))) ??
    (await deUmaFonte(`yahoo ${chave}`, `https://query2.finance.yahoo.com/v8/finance/chart/${from}${to}=X?range=1d&interval=1d`, (j) => parseYahooFxRate(j, from, to))) ??
    (await deUmaFonte(`frankfurter ${chave}`, `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, (j) => parseRatesTable(j, from, to))) ??
    (await deUmaFonte(`er-api ${chave}`, `https://open.er-api.com/v6/latest/${from}`, (j) => parseRatesTable(j, from, to)));

  // Nenhuma respondeu: a última conhecida, marcada como velha (cotação de ontem vale mais que nenhuma).
  if (!valor) return guardada ? { ...guardada.valor, stale: true } : null;
  memoria.set(chave, { valor, buscadoEm: Date.now() });
  return valor;
}

export function toCurrencyOrNull(value: unknown): CurrencyCode | null {
  return typeof value === "string" && isCurrencyCode(value) ? value : null;
}

export { CURRENCY_CODES };
