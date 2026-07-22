import { GradientPill } from "@/components/ui/GradientPill";
import { formatCompactBRL } from "@/lib/format";

export function GreetingStrip({
  greeting,
  dateLabel,
  summary,
  flow,
}: {
  /** Ex.: "Bom dia, Daniela.", já pronto, computado no servidor. */
  greeting: string;
  /** Ex.: "Terça-feira, 6 de julho" */
  dateLabel: string;
  /** 1 linha de resumo financeiro do momento, ex.: "Seu saldo este mês está positivo em R$ 1.500,00." */
  summary: string;
  /** Renda/Gastos/Aportes do mês, trio de pílulas com contorno em gradiente (documento de
   * referência de design). Omitido quando ainda não há nada lançado no mês. */
  flow?: { income: number; expense: number; investment: number };
}) {
  const hasFlow = flow && (flow.income > 0 || flow.expense > 0 || flow.investment > 0);
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5">
      <div className="flex flex-col gap-1">
        <p className="text-h2 font-serif italic font-normal tracking-tight text-ink">{greeting}</p>
        <p className="text-body text-ink-muted">
          {dateLabel} · {summary}
        </p>
      </div>
      {hasFlow && (
        <div className="flex flex-wrap gap-2.5">
          <GradientPill
            label="Renda"
            value={formatCompactBRL(flow.income)}
            colorFrom="color-mix(in srgb, var(--color-success) 60%, white)"
            colorTo="var(--color-success)"
          />
          <GradientPill
            label="Gastos"
            value={formatCompactBRL(flow.expense)}
            colorFrom="color-mix(in srgb, var(--color-danger) 60%, white)"
            colorTo="var(--color-danger)"
          />
          <GradientPill
            label="Aportes"
            value={formatCompactBRL(flow.investment)}
            colorFrom="var(--color-accent-2)"
            colorTo="var(--color-accent)"
          />
        </div>
      )}
    </div>
  );
}
