"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Tag, TriangleAlert } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, isParentCategoryKey } from "@/lib/categories";
import { aplicarAjustesDoPadraoAction } from "@/app/(app)/orcamento/actions";
import type { AjusteComRotulo } from "./SugestoesDoPadrao";

export type ItemDoResumo = { key: string; label: string; cor: string; planejado: number; iconeProprio?: string };

/**
 * "Seu plano" (protótipo, #editar-plano): o que "Editar meu plano" mostra primeiro. O cartão Por
 * mês com a barra das fatias, o aviso amarelo "N categorias fora do padrão · Ver o que muda" (o
 * padrão dos últimos 3 meses; nada muda sem o toque dela) e a lista das categorias com o valor.
 * "Ajustar" abre o montador.
 */
export function ResumoDoPlano({ itens, ajustes, onAjustar }: { itens: ItemDoResumo[]; ajustes: AjusteComRotulo[]; mes: string; onAjustar: () => void }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { categorias } = useProfileTheme();
  const { showToast, showError } = useToast();
  const [vendo, setVendo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const visiveis = itens.filter((i) => i.planejado > 0).sort((a, b) => b.planejado - a.planejado);
  const total = visiveis.reduce((s, i) => s + i.planejado, 0);
  const icone = (i: ItemDoResumo) => (isParentCategoryKey(i.key) ? categoryIcon(categorias, i.key) : (CUSTOM_CATEGORY_ICON_MAP[i.iconeProprio ?? ""] ?? Tag));

  function usar() {
    iniciar(async () => {
      const antes = ajustes.map((a) => ({ key: a.chave, valor: a.planoAtual }));
      const r = await aplicarAjustesDoPadraoAction(ajustes.map((a) => ({ key: a.chave, valor: a.sugerido })));
      if (r.error) return showError(r.error);
      // Tem Desfazer: fica a pílula, curta.
      showToast(ajustes.length === 1 ? "1 categoria ajustada" : `${ajustes.length} categorias ajustadas`, {
        label: "Desfazer",
        onClick: () =>
          iniciar(async () => {
            await aplicarAjustesDoPadraoAction(antes);
            router.refresh();
          }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" data-resumo-do-plano>
      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <b className="text-[15px] font-medium text-ink">Por mês</b>
        <p className="text-sm text-ink-muted">
          <span className="text-[1.5rem] font-light tabular-nums tracking-[-0.02em] text-ink">{m(total)}</span> divididos assim
        </p>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {visiveis.map((i, k) => (
            <span key={i.key} className="h-full" style={{ width: `${(i.planejado / Math.max(1, total)) * 100}%`, background: `var(--color-plano-${Math.min(7, k + 1)})` }} />
          ))}
        </div>
      </section>

      {ajustes.length > 0 && (
        <section className="flex flex-col gap-2 rounded-3xl bg-accent-soft p-3.5" data-fora-do-padrao>
          <button type="button" onClick={() => setVendo((v) => !v)} aria-expanded={vendo} className="flex items-center gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-strong">
              <TriangleAlert size={18} strokeWidth={1.6} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-medium text-ink">{ajustes.length === 1 ? "1 categoria fora do padrão" : `${ajustes.length} categorias fora do padrão`}</b>
              <small className="text-caption text-ink-muted">Ver o que muda</small>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-ink-muted transition-transform ${vendo ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {vendo && (
            <div className="flex flex-col gap-2 pt-1">
              <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-3">
                {ajustes.map((a) => (
                  <li key={a.chave} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-medium text-ink">{a.label}</b>
                      <small className="text-caption text-ink-muted">Você costuma gastar {m(a.padrao)}</small>
                    </span>
                    <em className={`shrink-0 not-italic tabular-nums ${a.sugerido > a.planoAtual ? "text-danger" : "text-success"}`}>
                      {a.sugerido > a.planoAtual ? "↑" : "↓"} {m(a.sugerido)}
                    </em>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={pendente} onClick={usar} className="min-h-11 rounded-full bg-surface text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)] disabled:opacity-50">
                Usar esses valores
              </button>
            </div>
          )}
        </section>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {visiveis.map((i) => (
          <li key={i.key} className="flex items-center gap-3 py-2.5">
            <CategoryIcon icon={icone(i)} color={i.cor} size={40} variant="soft" />
            <b className="min-w-0 flex-1 truncate text-[15px] font-normal text-ink">{i.label}</b>
            <em className="shrink-0 not-italic tabular-nums text-ink">{m(i.planejado)}</em>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onAjustar} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface">
        Ajustar
      </button>
    </div>
  );
}
