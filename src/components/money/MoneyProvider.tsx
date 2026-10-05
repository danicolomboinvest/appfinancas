"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gravarValoresOcultos } from "@/lib/valores-ocultos";
import {
  makeMoneyFormatter,
  DEFAULT_CURRENCY,
  type CurrencyCode,
  type MoneyFormatter,
} from "@/lib/money";

const CurrencyContext = createContext<CurrencyCode>(DEFAULT_CURRENCY);
const OcultosContext = createContext<{ ocultos: boolean; alternar: () => void }>({ ocultos: false, alternar: () => {} });

/**
 * A moeda escolhida, disponível pra todo componente de cliente sem passar por prop.
 *
 * Fica no topo do app (AppShell), alimentado pelo valor que o servidor já leu — os gráficos,
 * formulários e tabelas só chamam `useMoney()`. Sem isso, a moeda teria que descer de prop em
 * prop até o último tooltip de gráfico.
 */
export function MoneyProvider({
  currency,
  ocultos: ocultosDoServidor = false,
  children,
}: {
  currency: CurrencyCode;
  /** O olho do topo fechado (cookie lido pelo servidor). */
  ocultos?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ocultos, setOcultos] = useState(ocultosDoServidor);
  // Os componentes de cliente trocam na hora; os números que vêm prontos do servidor trocam
  // no refresh logo em seguida.
  const alternar = useCallback(() => {
    setOcultos((o) => {
      gravarValoresOcultos(!o);
      return !o;
    });
    router.refresh();
  }, [router]);
  const valorOcultos = useMemo(() => ({ ocultos, alternar }), [ocultos, alternar]);
  return (
    <CurrencyContext.Provider value={currency}>
      <OcultosContext.Provider value={valorOcultos}>{children}</OcultosContext.Provider>
    </CurrencyContext.Provider>
  );
}

/** O olho do topo: os valores estão escondidos? E o toque que troca. */
export function useValoresOcultos() {
  return useContext(OcultosContext);
}

export function useCurrency(): CurrencyCode {
  return useContext(CurrencyContext);
}

/** `const money = useMoney();` e depois `money(valor)` — mesma forma do `serverMoney()`. */
export function useMoney(): MoneyFormatter {
  const currency = useCurrency();
  const { ocultos } = useContext(OcultosContext);
  return useMemo(() => makeMoneyFormatter(currency, ocultos), [currency, ocultos]);
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
