import { Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { UpcomingDividend } from "@/lib/repositories/dividend.repo";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "21/08" — data curta, o ano quase nunca muda de uma linha pra outra nesta lista. */
function formatShortDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Cor do selo por tipo de provento — mesma linguagem visual do resto do app (dourado = renda). */
const KIND_TONE: Record<string, "accent" | "success" | "neutral"> = {
  Dividendos: "success",
  JSCP: "accent",
};

/**
 * "Próximos dividendos": calendário de proventos anunciados pros ativos da carteira, com valor
 * estimado (quantidade × valor por cota). Vem do investidor10, atualizado ao criar/importar um
 * ativo e todo dia via cron — a pessoa não pede nada, só aparece quando tem provento a caminho.
 */
export function UpcomingDividendsSection({ dividends }: { dividends: UpcomingDividend[] }) {
  if (dividends.length === 0) return null;

  const total = dividends.reduce((sum, d) => sum + d.estimatedTotal, 0);

  return (
    <div id="dividendos">
      <CollapsibleSection
        label={`Próximos dividendos · ${formatBRL(total)} previstos`}
        defaultOpen
      >
        <Card className="flex flex-col gap-1 p-2">
          {dividends.map((d, index) => (
            <div
              key={`${d.ticker}-${d.kind}-${d.paymentDate.toISOString()}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl p-2.5 hover:bg-surface-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <Coins className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{d.ticker}</span>
                    <Badge tone={KIND_TONE[d.kind] ?? "neutral"}>{d.kind}</Badge>
                  </div>
                  <p className="truncate text-xs text-ink-faint">
                    Data com {formatShortDate(d.exDate)} · Pagamento {formatShortDate(d.paymentDate)}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-success">{formatBRL(d.estimatedTotal)}</p>
                {/* JSCP: já líquido de 15% de IR. Tipo sem regra certa (ex.: "Rend. Trib."): valor
                    é bruto, aviso explícito em vez de fingir que sabemos o imposto. */}
                {d.taxTreatment === "jscp_15" && <p className="text-[10px] text-ink-faint">líquido de IR</p>}
                {d.taxTreatment === "desconhecido" && <p className="text-[10px] text-ink-faint">bruto, s/ IR</p>}
              </div>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-ink-faint">
          Estimativa com a quantidade de hoje — se você comprar ou vender antes da data-com, o valor muda. JSCP mostra
          já líquido dos 15% de IR retido na fonte; Dividendos e Rendimentos de FII costumam ser isentos. Fonte:
          investidor10.
        </p>
      </CollapsibleSection>
    </div>
  );
}
