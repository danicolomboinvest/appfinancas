"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import type { Saidas } from "@/lib/decisoes/posso-comprar";
import { criarSonhoDaCompraAction } from "@/app/(app)/planejamento/metas/actions";

/**
 * "Como fazer caber" (01/10/2026): quando a compra não cabe, em vez de só "guarde antes", o app
 * usa o orçamento dela. Primeiro, de onde dá para apertar (lazer, delivery, outros; nunca o
 * básico). Depois, quanto guardar por mês, com um toque para virar mais um sonho.
 */
export function ComoFazerCaber({ saidas, descricao, money }: { saidas: Saidas; descricao: string; money: (v: number) => string }) {
  const { showError } = useToast();
  const [criado, setCriado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const quando = saidas.porMes ? "por mês, enquanto durarem as parcelas" : "neste mês";
  const cobreTudo = saidas.cobre >= saidas.precisa - 0.5;
  const nome = descricao.trim() || "Compra planejada";

  function criarSonho() {
    iniciar(async () => {
      const r = await criarSonhoDaCompraAction({ nome, alvo: saidas.guardar.alvo, meses: saidas.guardar.meses });
      if (!r.ok) return showError(r.error);
      setCriado(r.id);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Como fazer caber</p>

      {saidas.cortes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">
            {cobreTudo ? (
              <>
                Segurando estes gastos {quando}, cabe <b>sem mexer no básico</b>:
              </>
            ) : (
              <>
                Segurando estes gastos {quando}, você cobre {money(saidas.cobre)} dos {money(saidas.precisa)} que faltam:
              </>
            )}
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {saidas.cortes.map((c) => (
              <li key={c.nome} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-ink">{c.nome}</span>
                <span className="font-semibold tabular-nums text-ink">−{money(c.valor)}</span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-ink-muted">Moradia, saúde e educação ficam de fora: o corte sai do que dá para trocar, como delivery por mercado ou um passeio a menos.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3">
        <p className="text-sm text-ink">
          {saidas.cortes.length > 0 ? "Ou guarde antes: " : "Guarde antes: "}
          <b>
            {money(saidas.guardar.mensal)} por mês por {saidas.guardar.meses} meses
          </b>{" "}
          e compre à vista, sem dívida.
        </p>
        {criado ? (
          <p className="text-sm font-semibold text-success">
            Sonho criado.{" "}
            <Link href={`/planejamento/metas/${criado}`} className="text-accent-strong underline">
              Ver o sonho
            </Link>
          </p>
        ) : (
          <button
            type="button"
            disabled={pendente}
            onClick={criarSonho}
            className="min-h-11 w-full rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50 sm:w-fit"
          >
            {pendente ? "Criando…" : `Criar o sonho "${nome}"`}
          </button>
        )}
      </div>
    </Card>
  );
}
