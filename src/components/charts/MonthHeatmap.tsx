import type { DailyFlowPoint } from "@/lib/consolidation/month-analysis";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Ritmo do mês: um quadradinho por dia, mais forte onde saiu mais dinheiro.
 *
 * Responde uma pergunta que o app tinha os dados pra responder e não respondia em lugar
 * nenhum: EM QUE DIAS você gasta. As curvas mostram o quanto; esta mostra o quando — fim de
 * semana, semana do salário, aquele sábado de compra grande. É o tipo de padrão que ninguém
 * descobre olhando lista de lançamentos, e que muda comportamento quando aparece.
 *
 * Em grade de semanas (e não uma fita de 30 quadradinhos) de propósito: alinhado por dia da
 * semana, o padrão de fim de semana vira uma coluna visível em vez de um ritmo que a pessoa
 * teria que contar de sete em sete.
 */
export function MonthHeatmap({
  points,
  daysInMonth,
  year,
  month,
}: {
  points: DailyFlowPoint[];
  daysInMonth: number;
  year: number;
  month: number;
}) {
  const spendByDay = new Map(points.map((p) => [p.day, p.expenseOfDay]));
  const maxSpend = Math.max(...points.map((p) => p.expenseOfDay), 0);
  if (maxSpend <= 0) return null;

  const peak = points.reduce((best, p) => (p.expenseOfDay > best.expenseOfDay ? p : best), points[0]);
  // Quantos quadradinhos vazios antes do dia 1, pra ele cair na coluna do dia da semana certo.
  const leadingBlanks = new Date(year, month - 1, 1).getDay();
  const lastLoggedDay = points.length > 0 ? points[points.length - 1].day : 0;

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid max-w-sm grid-cols-7 gap-1">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span key={i} className="text-center text-caption text-ink-faint">
            {initial}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`vazio-${i}`} />;
          const spent = spendByDay.get(day) ?? 0;
          // Dia que ainda não chegou fica só marcado, sem cor: zero gasto num dia futuro não é
          // "não gastou nada", é "ainda não aconteceu".
          const isFuture = day > lastLoggedDay;
          const intensity = spent > 0 ? 0.16 + (spent / maxSpend) * 0.84 : 0;
          return (
            <span
              key={day}
              title={isFuture ? `Dia ${day}` : `Dia ${day}: ${formatBRL(spent)}`}
              className={`flex aspect-square items-center justify-center rounded-md text-caption tabular-nums ${
                isFuture ? "border border-dashed border-border text-ink-faint" : "text-ink"
              }`}
              style={
                isFuture
                  ? undefined
                  : {
                      backgroundColor:
                        spent > 0 ? `color-mix(in srgb, var(--color-danger) ${intensity * 100}%, var(--color-surface-2))` : "var(--color-surface-2)",
                    }
              }
            >
              {day}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-caption text-ink-faint">
          Menos
          {[0.22, 0.48, 0.72, 1].map((level) => (
            <span
              key={level}
              className="size-3 rounded-sm"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-danger) ${level * 100}%, var(--color-surface-2))`,
              }}
            />
          ))}
          Mais
        </span>
        <span className="text-caption text-ink-muted">
          Dia de maior gasto: {peak.day} · {formatBRL(peak.expenseOfDay)}
        </span>
      </div>
    </div>
  );
}
