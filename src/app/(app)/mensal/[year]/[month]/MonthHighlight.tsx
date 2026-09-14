import { Sparkles, TrendingDown, TrendingUp, Info } from "lucide-react";
import type { Insight, InsightTone } from "@/lib/insights/month-insights";
import { CountUp } from "@/components/ui/CountUp";
import { FitText } from "@/components/ui/FitText";

const TONE_ICON: Record<InsightTone, typeof Sparkles> = {
  positive: TrendingDown,
  warning: TrendingUp,
  neutral: Info,
};

const TONE_CLASS: Record<InsightTone, string> = {
  positive: "text-success",
  warning: "text-danger",
  neutral: "text-ink-muted",
};

/**
 * O primeiro olhar do mês: um número-herói ("sobrou tanto") e, logo abaixo, o que isso
 * significa comparado ao mês passado. É a diferença entre a tela informar e a tela explicar —
 * o resto da página tem todos os números, aqui fica a leitura deles.
 *
 * Sobra = renda − gastos − aportes. Aporte sai da conta de propósito: é dinheiro que continua
 * sendo seu, mas que não está mais disponível pra gastar este mês.
 */
export function MonthHighlight({
  balance,
  income,
  expense,
  investment,
  insights,
}: {
  balance: number;
  income: number;
  expense: number;
  investment: number;
  insights: Insight[];
}) {
  const positive = balance >= 0;
  // Sem nenhum lançamento o card viraria "Sobrou R$ 0" com ar de veredito — melhor nem aparecer.
  if (income === 0 && expense === 0 && investment === 0) return null;

  return (
    <div className="glow-stage rounded-3xl p-4 sm:p-5">
      <div className="glass rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-label font-medium text-ink-muted">
              {positive ? "Sobrou este mês" : "Faltou este mês"}
            </p>
            <div className="mt-1.5">
              <FitText
                className={`text-h1 font-bold tracking-tight tabular-nums sm:text-display ${
                  positive ? "text-ink" : "text-danger"
                }`}
              >
                <CountUp value={Math.abs(balance)} brl />
              </FitText>
            </div>
            <p className="mt-1 text-caption text-ink-faint">
              Renda menos gastos e aportes
            </p>
          </div>
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            <Sparkles size={20} strokeWidth={1.9} />
          </span>
        </div>

        {insights.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {insights.map((insight, i) => {
              const Icon = TONE_ICON[insight.tone];
              return (
                <div key={i} className="flex items-start gap-2">
                  <Icon size={15} strokeWidth={2} className={`mt-0.5 shrink-0 ${TONE_CLASS[insight.tone]}`} />
                  <p className="text-sm text-ink-muted">{insight.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
