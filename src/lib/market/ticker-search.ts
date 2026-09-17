import { KNOWN_ETF_BR, KNOWN_ETF_US, KNOWN_FII, KNOWN_STOCK_BR, KNOWN_US_STOCK } from "./known-names";

export type TickerKind = "STOCK" | "FII" | "ETF" | "BDR" | "STOCK_INTL" | "ETF_INTL";

export type TickerHit = {
  ticker: string;
  /** Nome como se fala ("Petrobras", "Kinea Renda Imobiliária"); vazio quando ninguém sabe. */
  name: string;
  kind: TickerKind;
  /** Volume negociado no dia, pra ordenar o "mais negociados" quando a busca está vazia. */
  volume: number;
  /** Outro nome pelo qual a busca também acha (a razão social: "Petroleo Brasileiro"). */
  alias?: string;
};

export const KIND_LABEL: Record<TickerKind, string> = {
  STOCK: "Ação",
  FII: "FII",
  ETF: "ETF",
  BDR: "BDR",
  STOCK_INTL: "Stock",
  ETF_INTL: "ETF",
};

/** Sufixos de razão social que só atrapalham: "PETROLEO BRASILEIRO S.A. PETROBRAS" → "Petroleo Brasileiro Petrobras". */
const LEGAL_NOISE = /\b(s\.?a\.?|s\/a|ltda\.?|cia\.?|companhia|participacoes|participações|holding|on|pn|nm|n1|n2)\b/gi;

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(de|da|do|das|dos|e)$/.test(w)) return w;
      if (w.length <= 2) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function prettyName(raw: string, ticker: string): string {
  if (!raw || raw.toUpperCase() === ticker.toUpperCase()) return "";
  const cleaned = raw.replace(LEGAL_NOISE, " ").replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();
  return titleCase(cleaned);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Ativos de fora não vêm da fonte brasileira: entram da lista curada, na ordem em que ela está. */
function knownInternational(): TickerHit[] {
  const stocks = Object.entries(KNOWN_US_STOCK).map(([ticker, name], i) => ({ ticker, name, kind: "STOCK_INTL" as const, volume: 1_000_000 - i }));
  const etfs = Object.entries(KNOWN_ETF_US).map(([ticker, name], i) => ({ ticker, name, kind: "ETF_INTL" as const, volume: 1_000_000 - i }));
  return [...stocks, ...etfs];
}

type BrapiRow = { stock: string; name?: string; volume?: number | null; type?: string; subType?: string | null };

/** Traduz a lista da fonte pro nosso formato, tirando o que não é pra pessoa comum (fracionário, FIP, FIDC). */
export function fromBrapi(rows: BrapiRow[]): TickerHit[] {
  const out: TickerHit[] = [];
  for (const r of rows) {
    const ticker = r.stock?.toUpperCase();
    if (!ticker) continue;
    if (/^[A-Z]{4}\d{1,2}F$/.test(ticker)) continue; // mercado fracionário duplica cada ação
    let kind: TickerKind | null = null;
    if (r.type === "stock") kind = "STOCK";
    else if (r.type === "bdr") kind = "BDR";
    else if (r.type === "fund" && r.subType === "fii") kind = "FII";
    else if (r.type === "fund" && r.subType === "etf") kind = "ETF";
    if (!kind) continue;
    const legal = prettyName(r.name ?? "", ticker);
    const known =
      kind === "FII" ? KNOWN_FII[ticker]
      : kind === "ETF" ? KNOWN_ETF_BR[ticker]
      : kind === "STOCK" ? KNOWN_STOCK_BR[ticker]
      : kind === "BDR" ? bdrName(ticker)
      : undefined;
    const hit: TickerHit = { ticker, name: known ?? legal, kind, volume: Number(r.volume ?? 0) || 0 };
    if (known && legal && legal !== known) hit.alias = legal;
    out.push(hit);
  }
  return out;
}

/** BDR é a empresa de fora negociada aqui: AAPL34 → "Apple (BDR)". */
function bdrName(ticker: string): string | undefined {
  const base = ticker.replace(/\d+$/, "");
  const name = KNOWN_US_STOCK[base];
  return name ? `${name} (BDR)` : undefined;
}


const BRAPI_LIST = "https://brapi.dev/api/quote/list?limit=5000";
const DAY = 24 * 60 * 60 * 1000;
let memo: { at: number; hits: TickerHit[] } | null = null;

/**
 * O catálogo inteiro (~2.000 códigos da B3 + a lista curada de fora), em memória por um dia.
 * A busca acontece aqui dentro, letra a letra, sem bater na fonte a cada tecla.
 */
export async function getCatalogue(): Promise<TickerHit[]> {
  if (memo && Date.now() - memo.at < DAY) return memo.hits;
  let br: TickerHit[] = [];
  try {
    const token = process.env.BRAPI_TOKEN;
    const res = await fetch(token ? `${BRAPI_LIST}&token=${token}` : BRAPI_LIST, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = (await res.json()) as { stocks?: BrapiRow[] };
      br = fromBrapi(data.stocks ?? []);
    }
  } catch {
    // Sem a fonte, a lista curada ainda responde por FIIs, ETFs e ativos de fora.
  }
  if (br.length === 0) {
    br = [
      ...Object.entries(KNOWN_FII).map(([ticker, name], i) => ({ ticker, name, kind: "FII" as const, volume: 1_000_000 - i })),
      ...Object.entries(KNOWN_ETF_BR).map(([ticker, name], i) => ({ ticker, name, kind: "ETF" as const, volume: 1_000_000 - i })),
    ];
  }
  const hits = [...br, ...knownInternational()];
  // Só guarda quando a fonte respondeu; senão tenta de novo na próxima busca.
  if (br.length > 100) memo = { at: Date.now(), hits };
  return hits;
}

/**
 * Ranking simples e previsível: código que começa igual > nome que começa igual > nome que
 * contém. Empate desempata por volume (o que todo mundo negocia aparece primeiro).
 */
export function searchCatalogue(catalogue: TickerHit[], query: string, kinds: TickerKind[], limit = 12): TickerHit[] {
  const q = normalize(query);
  const pool = catalogue.filter((h) => kinds.includes(h.kind));
  // Lista de partida (nada digitado): quem tem nome primeiro — um código sem nome não ajuda
  // quem está rolando justamente porque não conhece os códigos.
  if (!q) return pool.sort((a, b) => Number(Boolean(b.name)) - Number(Boolean(a.name)) || b.volume - a.volume).slice(0, 30);
  const scored: { hit: TickerHit; score: number }[] = [];
  for (const hit of pool) {
    const t = hit.ticker.toLowerCase();
    const n = normalize(hit.name);
    const a = hit.alias ? normalize(hit.alias) : "";
    let score = 0;
    if (t === q) score = 5;
    else if (t.startsWith(q)) score = 4;
    else if (n.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (n.includes(q) || a.includes(q)) score = 2;
    else if (t.includes(q)) score = 1;
    if (score > 0) scored.push({ hit, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.hit.volume - a.hit.volume || a.hit.ticker.localeCompare(b.hit.ticker))
    .slice(0, limit)
    .map((s) => s.hit);
}

export async function searchTickers(query: string, kinds: TickerKind[]): Promise<TickerHit[]> {
  return searchCatalogue(await getCatalogue(), query, kinds);
}
