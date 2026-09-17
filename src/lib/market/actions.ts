"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { searchTickers, type TickerHit, type TickerKind } from "./ticker-search";

/** Busca de ativos pro campo de código: "petro" → PETR4 Petrobras. Volta só o que o campo mostra. */
export async function searchTickersAction(query: string, kinds: TickerKind[]): Promise<Pick<TickerHit, "ticker" | "name" | "kind">[]> {
  await getRequiredSession();
  const hits = await searchTickers(String(query ?? "").slice(0, 40), kinds);
  return hits.map(({ ticker, name, kind }) => ({ ticker, name, kind }));
}
