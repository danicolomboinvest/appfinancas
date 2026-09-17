import { Card } from "./Card";
import { StatCard } from "./StatCard";

type Tone = "success" | "danger" | "accent" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent-strong",
  neutral: "text-ink",
};

export type StatRowItem = { label: string; value: string; hint?: string; tone?: Tone };

/**
 * Quatro indicadores que no computador são quatro cards lado a lado e no celular viram
 * UMA lista: rótulo à esquerda, número à direita, uma linha por indicador.
 *
 * A grade de dois cards no celular dava 131px pra cada um: "Rendimento acima da inflação"
 * quebrava em três linhas, "R$ 1.234.567,89" encolhia, e os quatro cards ficavam com quatro
 * alturas diferentes. Em linhas, o rótulo tem a largura que precisar e o número fica inteiro,
 * na mesma leitura de cima pra baixo do bloco "Entrou / Gastou / Aportou".
 */
export function StatRows({ items, columns = 4 }: { items: StatRowItem[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <>
      <Card className="divide-y divide-border sm:hidden">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] text-ink">{item.label}</p>
              {item.hint && <p className="mt-0.5 text-xs leading-snug text-ink-faint">{item.hint}</p>}
            </div>
            <p className={`shrink-0 whitespace-nowrap text-[17px] font-semibold tabular-nums tracking-tight ${TONE_TEXT[item.tone ?? "neutral"]}`}>
              {item.value}
            </p>
          </div>
        ))}
      </Card>
      <div className={`hidden gap-4 sm:grid ${cols}`}>
        {items.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
        ))}
      </div>
    </>
  );
}
