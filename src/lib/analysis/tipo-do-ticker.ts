import type { SheetType } from "@prisma/client";

/** Código de bolsa: B3 (PETR4, MXRF11) ou de fora (VOO, AAPL). */
export function tickerValido(ticker: string): boolean {
  return /^[A-Z]{4}\d{1,2}$/.test(ticker) || /^[A-Z]{1,5}$/.test(ticker);
}

/**
 * Em que ordem tentar ler um código que a pessoa digitou (ou da carteira), pelo formato dele.
 * Final 3 a 8 é ação; final 11 pode ser FII, ETF ou unit (TAEE11); só letras é ETF ou ação de
 * fora. A primeira página que trouxer indicadores vence; com o tipo da carteira, ele vem antes.
 */
export function tiposParaTentar(ticker: string, sugerido: SheetType | null): SheetType[] {
  const t = ticker.toUpperCase();
  let ordem: SheetType[];
  if (/^[A-Z]{4}11$/.test(t)) ordem = ["FII", "ETF", "STOCK"];
  else if (/^[A-Z]{4}\d{1,2}$/.test(t)) ordem = ["STOCK"];
  else ordem = ["ETF", "STOCK_INTL"];
  return sugerido ? [sugerido, ...ordem.filter((x) => x !== sugerido)] : ordem;
}

/**
 * Nome de algumas empresas e fundos muito negociados, para o subtítulo e o logo quando a ficha não
 * tem nome (a fonte que o app lê não traz). É só o nome público do código; nenhum número sai daqui.
 */
const NOMES: Record<string, string> = {
  BBAS3: "Banco do Brasil",
  ITSA4: "Itaúsa",
  ITUB4: "Itaú Unibanco",
  BBDC4: "Bradesco",
  PETR4: "Petrobras",
  PETR3: "Petrobras",
  VALE3: "Vale",
  WEGE3: "WEG",
  TAEE11: "Taesa",
  EGIE3: "Engie Brasil",
  MXRF11: "Maxi Renda",
  HGLG11: "CSHG Logística",
  KNRI11: "Kinea Renda Imobiliária",
  XPLG11: "XP Log",
  VISC11: "Vinci Shopping Centers",
  IVVB11: "iShares S&P 500",
  BOVA11: "iShares Ibovespa",
  VOO: "Vanguard S&P 500",
  IVV: "iShares Core S&P 500",
  SPY: "SPDR S&P 500",
  QQQ: "Invesco QQQ",
};

export function nomeConhecido(ticker: string): string | null {
  return NOMES[ticker.trim().toUpperCase()] ?? null;
}
