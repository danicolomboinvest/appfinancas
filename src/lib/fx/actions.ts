"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { getUserCurrency } from "@/lib/money-server";
import { getExchangeRate, toCurrencyOrNull, type ExchangeRate } from "./rates";

/** Cotação de `from` na moeda do usuário, pra prévia no formulário ("≈ R$ 11.814"). */
export async function getExchangeRateAction(from: string): Promise<ExchangeRate | null> {
  await getRequiredSession();
  const code = toCurrencyOrNull(from);
  if (!code) return null;
  return getExchangeRate(code, await getUserCurrency());
}
