import { ChevronDown, Coins } from "lucide-react";
import type { Voz } from "@/lib/profiles/voice";
import { Badge } from "@/components/ui/Badge";
import type { UpcomingDividend } from "@/lib/repositories/dividend.repo";
import type { MoneyFormatter } from "@/lib/money";


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
 * Fechado por padrão desde 06/10/2026: a lista de 17 linhas aberta vinha antes do total da
 * carteira. Fechado, é uma linha com o valor; um toque abre.
 */
export function UpcomingDividendsSection({ dividends, voz, money }: { dividends: UpcomingDividend[]; voz: Voz; money: MoneyFormatter }) {
  if (dividends.length === 0) return null;

  const total = dividends.reduce((sum, d) => sum + d.estimatedTotal, 0);

  // Uma linha que abre a lista (07/10/2026, "mesma cara, menos texto"): o nome, o valor em negrito
  // e a seta. Antes era um link dourado solto com a frase "Próximos dividendos, R$ X previstos".
  return (
    <details id="dividendos" className="group rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success" aria-hidden>
          <Coins size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-caption text-ink-muted">{voz.titulos.divRotulo}</span>
          <span className="block text-[17px] font-semibold tabular-nums text-ink">{money(total)}</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border px-1.5 pb-3 pt-1.5">
        <div className="flex flex-col gap-1">
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
                    {voz.titulos.divDatas(formatShortDate(d.exDate), formatShortDate(d.paymentDate))}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-success">{money(d.estimatedTotal)}</p>
                {/* JSCP: já líquido de 15% de IR. Tipo sem regra certa (ex.: "Rend. Trib."): valor
                    é bruto, aviso explícito em vez de fingir que sabemos o imposto. */}
                {d.taxTreatment === "jscp_15" && <p className="text-xs text-ink-faint">{voz.titulos.divLiquido}</p>}
                {d.taxTreatment === "desconhecido" && <p className="text-xs text-ink-faint">{voz.titulos.divBruto}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 px-2 text-xs text-ink-faint">{voz.titulos.divNota}</p>
      </div>
    </details>
  );
}
