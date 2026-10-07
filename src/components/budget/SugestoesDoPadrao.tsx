"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import type { AjusteDoPadrao } from "@/lib/planning/padrao-orcamento";
import { aplicarAjustesDoPadraoAction } from "@/app/(app)/orcamento/actions";

export type AjusteComRotulo = AjusteDoPadrao & { label: string };

/**
 * "Olhamos o seu padrão dos últimos 3 meses": o orçamento que aprende com os extratos e faturas.
 *
 * Um aviso curto e UM botão que ajusta todas as categorias de uma vez (pedido da Dani,
 * 03/10/2026: a primeira versão, uma linha com explicação e botão por categoria, "fica muito
 * textão"). O que muda fica num "ver o que muda", fechado. Depois de ajustar, ela mexe no que
 * quiser pelo lápis de cada categoria. Vale deste mês até dezembro.
 */
export function SugestoesDoPadrao({ ajustes, mes, meses }: { ajustes: AjusteComRotulo[]; mes: string; meses: number }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [aberto, setAberto] = useState(false);
  const [feito, setFeito] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (feito || ajustes.length === 0) return null;

  function ajustarTudo() {
    iniciar(async () => {
      const r = await aplicarAjustesDoPadraoAction(ajustes.map((a) => ({ key: a.chave, valor: a.sugerido })));
      if (r.error) return showError(r.error);
      showToast(`Pronto: ${ajustes.length === 1 ? "1 categoria ajustada" : `${ajustes.length} categorias ajustadas`} de ${mes} em diante.`);
      setFeito(true);
      router.refresh();
    });
  }

  // Uma linha (07/10/2026): o alerta diz quantas categorias e tem UM botão. O porquê e o que muda
  // ficam no toque, para não competir com o número do topo.
  return (
    <section className="rounded-2xl border border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <SlidersHorizontal size={18} className="shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              {ajustes.length === 1 ? "1 categoria fora do padrão" : `${ajustes.length} categorias fora do padrão`}
            </span>
            <span className="flex items-center gap-1 text-caption text-ink-muted">
              Ver o que muda <ChevronDown size={14} className={`transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={ajustarTudo}
          className="min-h-11 shrink-0 rounded-full bg-pill px-4 text-sm font-semibold text-on-pill disabled:opacity-50"
        >
          {pendente ? "Ajustando…" : "Ajustar"}
        </button>
      </div>

      {aberto && (
        <ul className="mt-1 flex flex-col gap-1.5 border-t border-border pb-2 pt-3 text-sm">
          {ajustes.map((a) => (
            <li key={a.chave} className="flex items-baseline justify-between gap-3">
              <span className="text-ink">{a.label}</span>
              <span className="tabular-nums text-ink-muted">
                {a.planoAtual > 0 ? `${m(a.planoAtual)} → ` : "sem plano → "}
                <b className="text-ink">{m(a.sugerido)}</b>
              </span>
            </li>
          ))}
          <li className="pt-1 text-caption text-ink-faint">
            O que você costuma gastar nos últimos {meses} meses. Depois dá para mexer em qualquer um pelo lápis.
          </li>
        </ul>
      )}
    </section>
  );
}
