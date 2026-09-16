import { Sparkles, TrendingDown, TrendingUp, Info } from "lucide-react";
import type { Insight, InsightTone } from "@/lib/insights/month-insights";
import { Section } from "@/components/ui/Section";

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
  income,
  expense,
  investment,
  insights,
}: {
  income: number;
  expense: number;
  investment: number;
  insights: Insight[];
}) {
  // Sem nenhum lançamento o card viraria "Sobrou R$ 0" com ar de veredito — melhor nem aparecer.
  if (income === 0 && expense === 0 && investment === 0) return null;

  // Sem moldura: este é o número que a pessoa veio ver. Um card em volta dele só encolhe o
  // número e acrescenta uma borda — o destaque vem do tamanho e do espaço, não de uma caixa.
  // O VALOR não aparece mais aqui: o bloco Entrou/Saiu/Resultado logo acima já fecha a conta,
  // e repetir "R$ 195,65" duas vezes na mesma tela faz a pessoa procurar a diferença entre os
  // dois números que não existe. O que sobra aqui é o que nenhum número diz sozinho: o que
  // mudou desde o mês passado.
  if (insights.length === 0) return null;

  return (
    <Section title="O que mudou">
      <div className="flex flex-col gap-2.5">
        {insights.map((insight, i) => {
          const Icon = TONE_ICON[insight.tone];
          return (
            <div key={i} className="flex items-start gap-2.5">
              <Icon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${TONE_CLASS[insight.tone]}`} />
              <p className="text-sm text-ink">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
