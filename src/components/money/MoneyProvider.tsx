"use client";

import { createContext, useContext, useMemo } from "react";
import {
  makeMoneyFormatter,
  DEFAULT_CURRENCY,
  type CurrencyCode,
  type MoneyFormatter,
} from "@/lib/money";

const CurrencyContext = createContext<CurrencyCode>(DEFAULT_CURRENCY);

/**
 * A moeda escolhida, disponível pra todo componente de cliente sem passar por prop.
 *
 * Fica no topo do app (AppShell), alimentado pelo valor que o servidor já leu — os gráficos,
 * formulários e tabelas só chamam `useMoney()`. Sem isso, a moeda teria que descer de prop em
 * prop até o último tooltip de gráfico.
 */
export function MoneyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyCode {
  return useContext(CurrencyContext);
}

/** `const money = useMoney();` e depois `money(valor)` — mesma forma do `serverMoney()`. */
export function useMoney(): MoneyFormatter {
  const currency = useCurrency();
  return useMemo(() => makeMoneyFormatter(currency), [currency]);
}

/** Valor em dinheiro pronto pra JSX, pra quando não vale a pena chamar o hook. */
export function Money({
  value,
  round,
  compact,
}: {
  value: number;
  round?: boolean;
  compact?: boolean;
}) {
  const money = useMoney();
  return <>{money(value, { round, compact })}</>;
}
