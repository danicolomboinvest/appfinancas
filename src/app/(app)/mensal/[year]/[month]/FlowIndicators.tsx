"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { FitText } from "@/components/ui/FitText";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { estadoDoMes } from "@/lib/profiles/voice";

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
/** (renda − gastos) / renda: quanto da renda não virou gasto (ficou de saldo + aportes). */
function savingsRate(b: FlowBundle): number | null {
  if (b.income <= 0) return null;
  return (b.income - b.expense) / b.income;
}

function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}



/** As cores de cada parcela do mês, as mesmas da rosca "Como sua renda foi dividida". */
const BOLHA = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent-strong",
} as const;
const BARRA = { success: "bg-success", danger: "bg-danger", accent: "bg-accent" } as const;

/**
 * Cabeçalho do Fluxo (item 2 da Rodada 2): 6 indicadores em cards (número grande, rótulo pequeno),
 * seletor de período e alternância Mensal/Anual. O toggle é estado local (troca instantânea); os
 * dois conjuntos de dados já vêm calculados do servidor, então não há ida-e-volta ao trocar. As
 * setas ‹ › navegam por mês (ou ano, no modo anual) via Link, carregando ?view pra manter o modo.
 */
export function FlowIndicators({
  year,
  month,
  initialView,
  monthly,
  annual,
  mesFechado = false,
}: {
  year: number;
  month: number;
  initialView: View;
  monthly: FlowBundle;
  annual: FlowBundle;
  /** O mês já acabou? A voz muda "ainda dá" pra "acabou". */
  mesFechado?: boolean;
}) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const [view, setView] = useState<View>(initialView);
  const bundle = view === "mensal" ? monthly : annual;
  const rate = savingsRate(bundle);
  // Bom, normal ou ruim vem ANTES da frase: é o que impede "É pouco? Sim" de aparecer pra
  // quem tem R$ 3.200 sobrando. Cada tema só escolhe COMO dizer o que os números já disseram.
  const estado = estadoDoMes(bundle);
  const fraseDoResultado =
    view === "mensal" ? voz.fraseResultado(estado, { resultado: bundle.balance, income: bundle.income, expense: bundle.expense, money, mesFechado }) : null;
  // Mês no vermelho: "Faltou", não "Sobrou −R$ 300".
  const rotuloDoResultado = bundle.balance < 0 && voz.rotuloResultado.startsWith("Sobrou") ? "Faltou" : voz.rotuloResultado;
  // A barra do que entrou, dividida em Gastou · Guardado · Sobrou. Só quando entrou dinheiro e
  // nada passou do que entrou: com gasto maior que a renda, as fatias não fecham 100%.
  const fatias =
    bundle.income > 0 && bundle.expense >= 0 && bundle.investment >= 0 && bundle.balance >= 0
      ? [
          { chave: "gastou", rotulo: voz.titulos.gastou, valor: bundle.expense, cor: "danger" as const },
          { chave: "guardado", rotulo: voz.titulos.aportou, valor: bundle.investment, cor: "accent" as const },
          { chave: "sobrou", rotulo: rotuloDoResultado, valor: bundle.balance, cor: "success" as const },
        ].filter((f) => f.valor > 0)
      : [];

  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);
  const periodLabel = view === "mensal" ? `${MONTH_LABELS[month - 1]} de ${year}` : String(year);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {/* Seletor de período */}
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label={`Anterior: ${prevArrowLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="min-w-[7.5rem] text-center text-sm font-medium text-ink">{periodLabel}</span>
          <Link
            href={nextHref}
            aria-label={`Próximo: ${nextArrowLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Toggle Mensal / Anual (segmented control) */}
        <div className="flex items-center rounded-full border border-border bg-surface-2 p-0.5">
          {(["mensal", "anual"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* O painel do mês (06/10/2026, segunda versão): o bloco pintado com os quatro números a Dani
          não achou bonito. Agora são três cartõezinhos com o ícone redondo colorido (o mesmo jeito
          dos botões da Carteira, que ela gostou) e, embaixo, o que sobrou com a barra do que
          entrou dividida em gasto, guardado e sobra. Os nomes vêm do tema. */}
      {voz.tituloPainel && <p className="-mb-2 text-caption font-medium text-ink-muted">{voz.tituloPainel}</p>}
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-3">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {[
            { chave: "entrou", rotulo: voz.titulos.entrou, valor: bundle.income, Icone: ArrowDownLeft, cor: "success" as const },
            { chave: "gastou", rotulo: voz.titulos.gastou, valor: bundle.expense, Icone: ArrowUpRight, cor: "danger" as const },
            // Guardar também TIRA dinheiro do mês: sem esta parcela a conta não fechava.
            { chave: "guardado", rotulo: voz.titulos.aportou, valor: bundle.investment, Icone: PiggyBank, cor: "accent" as const },
          ].map(({ chave, rotulo, valor, Icone, cor }) => (
            <div key={chave} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 lg:p-4">
              <span className={`flex size-8 items-center justify-center rounded-full ${BOLHA[cor]}`}>
                <Icone size={16} strokeWidth={2.1} aria-hidden />
              </span>
              <span className="text-caption leading-tight text-ink-muted">{rotulo}</span>
              <FitText className="text-[16px] font-semibold tabular-nums tracking-tight text-ink lg:text-[20px]">{money(valor)}</FitText>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-caption text-ink-muted">{rotuloDoResultado}</p>
              <FitText className={`text-[28px] font-bold leading-tight tracking-tight tabular-nums ${bundle.balance < 0 ? "text-danger" : "text-ink"}`}>
                {money(bundle.balance)}
              </FitText>
            </div>
            {rate !== null && rate >= 0 && (
              <span className="mb-1 shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-caption font-semibold text-success">
                {voz.titulos.ficouComVoce(`${Math.round(rate * 100)}%`)}
              </span>
            )}
          </div>

          {fatias.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={fatias.map((f) => `${f.rotulo} ${Math.round((f.valor / bundle.income) * 100)}%`).join(", ")}>
                {fatias.map((f) => (
                  <span key={f.chave} className={`h-full ${BARRA[f.cor]}`} style={{ width: `${(f.valor / bundle.income) * 100}%` }} />
                ))}
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
                {fatias.map((f) => (
                  <span key={f.chave} className="inline-flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${BARRA[f.cor]}`} />
                    {f.rotulo} {Math.round((f.valor / bundle.income) * 100)}%
                  </span>
                ))}
              </p>
            </div>
          )}

          {/* O plano do mês mora no Orçamento: daqui só a referência e o caminho. */}
          {bundle.planned > 0 && (
            <Link href={`/orcamento/${year}`} className="flex items-center justify-between gap-2 border-t border-border pt-3 text-caption text-ink-muted transition-colors hover:text-ink">
              <span>
                {voz.titulos.gastou} {money(bundle.expense, { round: true })} {voz.titulos.dePlanejados(money(bundle.planned, { round: true }))}
              </span>
              <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
            </Link>
          )}
        </div>
      </div>
      {fraseDoResultado && <p className="-mt-1 text-sm text-ink lg:text-[15px]">{fraseDoResultado}</p>}
    </div>
  );
}
