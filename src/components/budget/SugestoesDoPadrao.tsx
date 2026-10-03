"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import type { AjusteDoPadrao } from "@/lib/planning/padrao-orcamento";
import { definirPlanoDaCategoriaAction } from "@/app/(app)/orcamento/actions";

export type AjusteComRotulo = AjusteDoPadrao & { label: string };

/**
 * "Seu padrão dos últimos 3 meses": o orçamento que aprende com os extratos e faturas dela.
 *
 * Cada linha diz o que viu (os três meses), o que propõe e por quê, com um botão só. Aplicar vale
 * deste mês até dezembro, igual ao lápis do "Planejado" (definirPlanoDaCategoriaAction). Nada
 * muda sozinho: o plano é dela, o app só aponta onde ele não bate com a vida real.
 */
export function SugestoesDoPadrao({ ajustes, mes, rotulosDosMeses }: { ajustes: AjusteComRotulo[]; mes: string; rotulosDosMeses: string[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());
  const [pendente, iniciar] = useTransition();

  const visiveis = ajustes.filter((a) => !aplicados.has(a.chave));
  if (visiveis.length === 0) return null;

  function aplicar(a: AjusteComRotulo) {
    iniciar(async () => {
      const r = await definirPlanoDaCategoriaAction({ key: a.chave, valor: a.sugerido });
      if (r.error) return showError(r.error);
      showToast(`${a.label}: ${m(a.sugerido)} por mês de ${mes} em diante.`);
      setAplicados((prev) => new Set(prev).add(a.chave));
      router.refresh();
    });
  }

  const meses = rotulosDosMeses.slice(-(visiveis[0]?.meses.length ?? 0));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-ink">Seu padrão dos últimos {meses.length} meses</h2>
          <p className="text-sm text-ink-muted">
            Olhei os seus extratos e faturas e achei onde o plano não bate com o jeito que você gasta de verdade.
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {visiveis.map((a) => (
          <li key={a.chave} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0">
            <p className="text-sm text-ink">
              <b>{a.label}</b>
              {": "}
              {a.tipo === "subir" && (
                <>
                  o plano é {m(a.planoAtual)}, mas você costuma gastar uns <b>{m(a.padrao)}</b>. Um plano que você não consegue cumprir
                  vira estouro todo mês.
                </>
              )}
              {a.tipo === "baixar" && (
                <>
                  o plano é {m(a.planoAtual)}, mas você costuma gastar só uns <b>{m(a.padrao)}</b>. Baixando, sobram{" "}
                  <b>{m(a.planoAtual - a.sugerido)}</b> por mês para guardar.
                </>
              )}
              {a.tipo === "criar" && (
                <>
                  não tem plano, e você costuma gastar uns <b>{m(a.padrao)}</b> por mês.
                </>
              )}
            </p>
            <p className="text-xs text-ink-muted">
              {a.meses.map((v, i) => `${meses[i] ?? ""} ${m(v)}`.trim()).join(" · ")}
            </p>
            <button
              type="button"
              disabled={pendente}
              onClick={() => aplicar(a)}
              className="min-h-11 w-fit rounded-full bg-pill px-4 text-sm font-semibold text-on-pill disabled:opacity-50"
            >
              {a.tipo === "criar" ? `Criar com ${m(a.sugerido)}` : `Mudar para ${m(a.sugerido)}`}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-caption text-ink-faint">
        Vale de {mes} em diante. O número é o do mês do meio dos três: um mês fora da curva, como uma viagem, não puxa a sugestão.
      </p>
    </section>
  );
}
