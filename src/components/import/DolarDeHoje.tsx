"use client";

import { useEffect, useState } from "react";
import { getExchangeRateAction } from "@/lib/fx/actions";
import { useMoney } from "@/components/money/MoneyProvider";

/** Uma busca por moeda na tela: três compras em dólar não fazem três pedidos. */
const cotacoes = new Map<string, Promise<number | null>>();
function cotacaoDe(moeda: string): Promise<number | null> {
  let p = cotacoes.get(moeda);
  if (!p) {
    p = getExchangeRateAction(moeda)
      .then((r) => (r && r.rate > 0 ? r.rate : null))
      .catch(() => null);
    cotacoes.set(moeda, p);
  }
  return p;
}

/**
 * "Usar o dólar de hoje" (15/10/2026, pedido da Dani): a compra em dólar do print pede o valor em
 * reais, que só sai quando a fatura fecha. O botão preenche com a cotação de agora, para simplificar;
 * o campo continua editável e o valor da fatura fechada corrige depois.
 */
export function DolarDeHoje({ moeda, valorDeFora, valorAtual, usar }: { moeda: "USD" | "EUR" | "GBP" | null; valorDeFora: number; valorAtual: number | undefined; usar: (reais: number) => void }) {
  const money = useMoney();
  const [cotacao, setCotacao] = useState<number | null>(null);
  useEffect(() => {
    if (!moeda) return;
    let vivo = true;
    cotacaoDe(moeda).then((c) => vivo && setCotacao(c));
    return () => {
      vivo = false;
    };
  }, [moeda]);
  if (!moeda || !cotacao) return null;
  const reais = Math.round(valorDeFora * cotacao * 100) / 100;
  if (valorAtual !== undefined && Math.abs(valorAtual - reais) < 0.01) return null;
  const nome = moeda === "USD" ? "dólar" : moeda === "EUR" ? "euro" : "libra";
  return (
    <button type="button" onClick={() => usar(reais)} className="inline-flex min-h-10 w-fit items-center rounded-full bg-accent-soft px-4 text-[14px] font-semibold text-accent-strong" data-dolar-de-hoje>
      Usar o {nome} de hoje: {money(reais)}
    </button>
  );
}
