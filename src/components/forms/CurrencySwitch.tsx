"use client";

import { useEffect, useId, useState } from "react";
import { CURRENCY_CODES, CURRENCIES, currencySymbol, formatMoney, type CurrencyCode } from "@/lib/money";
import { convertAmount } from "@/lib/fx/rates";
import { getExchangeRateAction } from "@/lib/fx/actions";

/**
 * Seletor de moeda do lançamento, ao lado do rótulo "Valor". Discreto de propósito: quem lança
 * tudo em real nunca precisa tocar nele; quem recebe em euro troca uma vez e o campo já
 * mascara em euro.
 */
export function CurrencySwitch({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <select
      aria-label="Moeda do lançamento"
      value={value}
      onChange={(e) => onChange(e.target.value as CurrencyCode)}
      className="h-6 rounded-md border border-border-strong bg-surface-2 px-1.5 text-[11px] font-medium text-ink-muted focus:border-accent focus:outline-none"
    >
      {CURRENCY_CODES.map((code) => (
        <option key={code} value={code}>
          {currencySymbol(code)} {CURRENCIES[code].label}
        </option>
      ))}
    </select>
  );
}

/** Aceita "5,9071" e "5.9071". */
function parseRate(text: string): number | null {
  const n = Number(text.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatRate(rate: number): string {
  return rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * A cotação e a prévia do que vai pro mês: "1 € = R$ 5,91 hoje · ≈ R$ 11.814".
 *
 * A cotação vem preenchida pela fonte do dia, mas é um campo editável: o banco de quem mora
 * fora fecha a remessa numa cotação própria, e o que importa é o que caiu na conta dela.
 */
export function ExchangeRateLine({
  from,
  to,
  amount,
  defaultRate,
}: {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  /** Cotação já guardada (edição): usa essa em vez de buscar a de hoje. */
  defaultRate?: number;
}) {
  const id = useId();
  const [text, setText] = useState(defaultRate ? formatRate(defaultRate) : "");
  const [status, setStatus] = useState<"idle" | "loading" | "today" | "failed">(defaultRate ? "idle" : "loading");
  const [today, setToday] = useState<{ rate: number; date: string } | null>(null);

  // Trocar de moeda REMONTA este componente (o pai usa `key={currency}`), então o estado
  // inicial já é "buscando" e o effect só recebe a resposta.
  useEffect(() => {
    let alive = true;
    getExchangeRateAction(from).then((r) => {
      if (!alive) return;
      if (!r) {
        setStatus((s) => (s === "loading" ? "failed" : s));
        return;
      }
      setToday({ rate: r.rate, date: r.date });
      if (!defaultRate) {
        setText(formatRate(r.rate));
        setStatus("today");
      }
    });
    return () => {
      alive = false;
    };
  }, [from, to, defaultRate]);

  const rate = parseRate(text);
  const symbol = (c: CurrencyCode) => formatMoney(1, c).replace(/[\d.,\s]/g, "").trim();

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="shrink-0 text-xs text-ink-muted">
          1 {symbol(from)} =
        </label>
        <span className="text-xs text-ink-muted">{symbol(to)}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={status === "loading" ? "buscando…" : "cotação"}
          className="w-24 rounded-md border border-border-strong bg-canvas px-2 py-1 text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
        />
        <input type="hidden" name="exchangeRate" value={rate ?? ""} />
      </div>
      {rate && amount > 0 ? (
        <p className="text-sm font-semibold tabular-nums text-ink">
          ≈ {formatMoney(convertAmount(amount, rate), to)}
          <span className="ml-1 text-xs font-normal text-ink-muted">é o que entra no seu mês</span>
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-ink-faint">
        {status === "loading" && "Buscando a cotação de hoje…"}
        {status === "today" && today && `Cotação de hoje. Se o seu banco fechou diferente, ajuste aqui.`}
        {status === "failed" && "Não achei a cotação de hoje. Digite a que o seu banco usou."}
        {status === "idle" &&
          (today && rate && Math.abs(today.rate - rate) / today.rate > 0.005
            ? `Cotação guardada nesse lançamento. Hoje está em ${formatRate(today.rate)}.`
            : "Cotação guardada nesse lançamento.")}
      </p>
    </div>
  );
}
