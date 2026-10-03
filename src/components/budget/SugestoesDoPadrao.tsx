"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
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

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-ink">Olhamos o seu padrão dos últimos {meses} meses</h2>
          <p className="text-sm text-ink-muted">
            {ajustes.length === 1 ? "Uma categoria não bate" : `${ajustes.length} categorias não batem`} com o jeito que você gasta de
            verdade.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pendente}
          onClick={ajustarTudo}
          className="min-h-11 rounded-full bg-pill px-5 text-sm font-semibold text-on-pill disabled:opacity-50"
        >
          {pendente ? "Ajustando…" : "Ajustar categorias"}
        </button>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Ver o que muda <ChevronDown size={16} className={`transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {aberto && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
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
            Cada valor é o que você costuma gastar (o mês do meio dos {meses}). Depois dá para mexer em qualquer um pelo lápis.
          </li>
        </ul>
      )}
    </section>
  );
}
