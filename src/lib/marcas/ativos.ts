import { TICKERS_COM_LOGO } from "./ativos-lista";
import { marcaDaDescricao } from "./marca";

/**
 * Qual logo mostrar para um ativo (Análises, Carteira e qualquer lista de ativos).
 *
 * 1. Ticker da B3 com ícone oficial baixado (ativos-lista.ts): o ícone da brapi.
 * 2. Ação ou ETF americano: o ícone do BDR da mesma empresa ou gestora (AAPL usa o do AAPL34).
 * 3. Sem ícone: o nome do ativo pode casar com uma marca do catálogo ("CDB Banco Inter" vira Inter).
 * 4. Nada disso: null, e a tela mostra as letras do código na cor da marca (ou do tema).
 */
const COM_LOGO = new Set(TICKERS_COM_LOGO);

/** Código americano → arquivo do mesmo emissor que já está em public/logos/ativos/. */
const DE_FORA: Record<string, string> = {
  AAPL: "AAPL34.svg",
  AMZN: "AMZO34.svg",
  MSFT: "MSFT34.svg",
  GOOGL: "GOGL34.svg",
  GOOG: "GOGL34.svg",
  META: "M1TA34.svg",
  NVDA: "NVDC34.svg",
  TSLA: "TSLA34.svg",
  NFLX: "NFLX34.svg",
  DIS: "DISB34.svg",
  NKE: "NIKE34.svg",
  V: "VISA34.svg",
  WMT: "WALM34.svg",
  JPM: "JPMC34.svg",
  BAC: "BOAC34.svg",
  INTC: "ITLC34.svg",
  ORCL: "ORCL34.svg",
  PFE: "PFIZ34.svg",
  PEP: "PEPB34.svg",
  AVGO: "AVGO34.svg",
  AMD: "A1MD34.svg",
  "BRK.B": "BERK34.svg",
  BRKB: "BERK34.svg",
  MELI: "MELI34.svg",
  NU: "ROXO34.svg",
  INTR: "INBR32.svg",
  XP: "XPBR31.svg",
  STNE: "STOC34.svg",
  PAGS: "PAGS34.svg",
  TSM: "TSMC34.svg",
  BABA: "BABA34.svg",
  CRM: "SSFO34.svg",
  LLY: "LILY34.svg",
  VZ: "VERZ34.svg",
  MU: "MUTC34.svg",
  // ETFs americanos: o ícone da gestora.
  IVV: "IVVB11.svg",
  IBIT: "IBIT39.svg",
  QQQ: "invesco.webp",
  SCHD: "schwab.webp",
};

/** Cor das letras de quem não tem ícone limpo (gestora conhecida); o resto usa a cor do tema. */
const COR_SEM_LOGO: Record<string, string> = {
  VOO: "#96151D",
  VTI: "#96151D",
  VT: "#96151D",
  VXUS: "#96151D",
  VNQ: "#96151D",
  BND: "#96151D",
  SPY: "#2C3E50",
  DIA: "#2C3E50",
};

export type LogoDeAtivo =
  | { tipo: "icone"; src: string }
  | { tipo: "marca"; marca: NonNullable<ReturnType<typeof marcaDaDescricao>> }
  | { tipo: "letras"; texto: string; cor: string | null };

export function arquivoDoAtivo(ticker: string | null | undefined): string | null {
  const t = (ticker ?? "").trim().toUpperCase();
  if (!t) return null;
  if (COM_LOGO.has(t)) return `/logos/ativos/${t}.svg`;
  if (DE_FORA[t]) return `/logos/ativos/${DE_FORA[t]}`;
  return null;
}

export function logoDoAtivo(ticker: string | null | undefined, nome?: string | null): LogoDeAtivo {
  const src = arquivoDoAtivo(ticker);
  if (src) return { tipo: "icone", src };
  const marca = marcaDaDescricao(nome) ?? marcaDaDescricao(ticker);
  if (marca) return { tipo: "marca", marca };
  const t = (ticker ?? nome ?? "").trim().toUpperCase();
  return { tipo: "letras", texto: t.replace(/\d+$/, "").slice(0, 4), cor: COR_SEM_LOGO[t] ?? null };
}
