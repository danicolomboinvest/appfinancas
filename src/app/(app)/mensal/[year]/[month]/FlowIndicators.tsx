"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { FitText } from "@/components/ui/FitText";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type FlowBundle = {
  income: number;
  expense: number;
  planned: number;
  investment: number;
  balance: number;
};

type View = "mensal" | "anual";
function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}



/** A cor de cada quadrado: a mesma convenção do app (verde entrou, vermelho saiu, dourado guardado). */
const COR = { success: "text-success", danger: "text-danger", accent: "text-accent-strong" } as const;

/**
 * O painel do Mensal (07/10/2026, "mesma cara, menos texto", aprovado pela Dani): quatro quadrados,
 * Entrou, Gastou, Guardado e Sobrou, cada um com o rótulo, o número e o quanto ele é da renda. Antes
 * eram três cartõezinhos, um cartão grande do Sobrou com barra e legenda, o "Ficou com você", o
 * "Gastou X de Y planejados" e uma frase embaixo, e o mesmo número aparecia até cinco vezes na tela.
 * O seletor de período e o Mensal/Anual continuam em cima; os dois conjuntos já vêm do servidor.
 */
export function FlowIndicators({
  year,
  month,
  initialView,
  monthly,
  annual,
}: {
  year: number;
  month: number;
  initialView: View;
  monthly: FlowBundle;
  annual: FlowBundle;
}) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const [view, setView] = useState<View>(initialView);
  const bundle = view === "mensal" ? monthly : annual;
  // Mês no vermelho: "Faltou", não "Sobrou −R$ 300".
  const faltou = bundle.balance < 0;
  const rotuloDoResultado = faltou && voz.rotuloResultado.startsWith("Sobrou") ? "Faltou" : voz.rotuloResultado;
  const pct = (v: number) => (bundle.income > 0 && v >= 0 ? voz.titulos.doQueEntrou(`${Math.round((v / bundle.income) * 100)}%`) : null);

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);
  const periodLabel = view === "mensal" ? `${MONTH_LABELS[month - 1]} ${year}` : String(year);

  // Setas: no modo mensal andam mês a mês; no anual, ano a ano (12 meses). Mantêm ?view.
  const prevHref =
    view === "mensal"
      ? `/mensal/${prev.year}/${prev.month}?view=mensal`
      : `/mensal/${year - 1}/${month}?view=anual`;
  const nextHref =
    view === "mensal"
      ? `/mensal/${next.year}/${next.month}?view=mensal`
      : `/mensal/${year + 1}/${month}?view=anual`;
  const prevArrowLabel = view === "mensal" ? MONTH_SHORT[prev.month - 1] : String(year - 1);
  const nextArrowLabel = view === "mensal" ? MONTH_SHORT[next.month - 1] : String(year + 1);

  const quadrados = [
    { chave: "entrou", rotulo: voz.titulos.entrou, valor: bundle.income, Icone: ArrowDownLeft, cor: "success" as const, detalhe: null },
    { chave: "gastou", rotulo: voz.titulos.gastou, valor: bundle.expense, Icone: ArrowUpRight, cor: "danger" as const, detalhe: pct(bundle.expense) },
    // Guardar também TIRA dinheiro do mês: sem esta parcela a conta não fechava.
    { chave: "guardado", rotulo: voz.titulos.aportou, valor: bundle.investment, Icone: PiggyBank, cor: "accent" as const, detalhe: pct(bundle.investment) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {/* Seletor de período */}
        <div className="flex min-w-0 items-center gap-0.5">
          <Link
            href={prevHref}
            aria-label={`Anterior: ${prevArrowLabel}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="whitespace-nowrap text-center text-base font-semibold text-ink">{periodLabel}</span>
          <Link
            href={nextHref}
            aria-label={`Próximo: ${nextArrowLabel}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Toggle Mensal / Anual (segmented control) */}
        <div className="flex shrink-0 items-center rounded-full border border-border bg-surface-2 p-0.5">
          {(["mensal", "anual"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {voz.tituloPainel && <p className="-mb-1 text-caption font-medium text-ink-muted">{voz.tituloPainel}</p>}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {quadrados.map(({ chave, rotulo, valor, Icone, cor, detalhe }) => (
          <div key={chave} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-3.5 lg:p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm leading-tight text-ink-muted">{rotulo}</span>
              <Icone size={18} strokeWidth={2} className={`shrink-0 ${COR[cor]}`} aria-hidden />
            </div>
            <FitText className="mt-2 text-[22px] font-bold tabular-nums tracking-tight text-ink lg:text-[26px]">{money(valor, { round: true })}</FitText>
            {detalhe && <span className="mt-0.5 text-caption text-ink-muted">{detalhe}</span>}
          </div>
        ))}
        {/* O que sobrou é o quadrado que responde a pergunta da tela ("e aí, sobrou?"): ganha a
            cor do resultado, verde clarinho ou vermelho clarinho. */}
        <div className={`flex min-w-0 flex-col rounded-2xl border p-3.5 lg:p-4 ${faltou ? "border-danger/25 bg-danger-soft" : "border-success/25 bg-success-soft"}`}>
          <span className="text-sm leading-tight text-ink-muted">{rotuloDoResultado}</span>
          <FitText className={`mt-2 text-[22px] font-bold tabular-nums tracking-tight lg:text-[26px] ${faltou ? "text-danger" : "text-success"}`}>
            {money(bundle.balance, { round: true })}
          </FitText>
          {pct(bundle.balance) && <span className="mt-0.5 text-caption text-ink-muted">{pct(bundle.balance)}</span>}
        </div>
      </div>
    </div>
  );
}
