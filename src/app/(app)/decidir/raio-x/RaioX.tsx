"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { decidirRaioXAction } from "@/app/(app)/mensal/foco/actions";
import { economiaAnual, valorFuturo, type RaioXItem } from "@/lib/decisoes/raio-x";

type Decisao = "raiox_cancelar" | "raiox_metade" | "raiox_manter";

export function RaioX({ itens, decididos }: { itens: RaioXItem[]; decididos: Record<string, Decisao> }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [escolhas, setEscolhas] = useState<Record<string, Decisao>>(decididos);
  const [, start] = useTransition();

  const totalMensal = itens.reduce((s, i) => s + i.mensal, 0);
  const economia = itens.reduce((s, i) => s + (escolhas[i.chave] ? economiaAnual(i, escolhas[i.chave]) : 0), 0);

  const decidir = (item: RaioXItem, decisao: Decisao) => {
    setEscolhas((e) => ({ ...e, [item.chave]: decisao }));
    start(() => decidirRaioXAction({ chave: item.chave, nome: item.nome, decisao, economiaAnual: economiaAnual(item, decisao) }));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <p className="text-caption text-ink-muted">Juntos, por ano</p>
        <p className="text-[2.25rem] font-bold leading-none tracking-tight tabular-nums text-ink">{m(totalMensal * 12)}</p>
        <p className="mt-1.5 text-caption text-ink-muted">
          Investidos por 5 anos, virariam cerca de <b className="text-ink">{m(valorFuturo(totalMensal, 60))}</b>
        </p>
      </Card>
      <p className="px-1 text-sm text-ink-muted">{t.raioxIntro}</p>
      <Card className="flex flex-col divide-y divide-border px-5 py-1">
        {itens.map((item) => {
          const e = escolhas[item.chave];
          const botao = (d: Decisao, rotulo: string) => (
            <button
              type="button"
              aria-pressed={e === d}
              onClick={() => decidir(item, d)}
              className={`rounded-xl px-3 py-1.5 text-caption font-semibold transition-colors ${e === d ? "bg-accent-soft text-accent-strong ring-2 ring-accent" : d === "raiox_manter" ? "border border-border text-ink-muted" : "bg-accent-soft text-accent-strong"}`}
            >
              {rotulo}
            </button>
          );
          return (
            <div key={item.chave} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.nome}</p>
                  <p className="text-caption text-ink-faint">
                    {item.tipo === "assinatura" ? `Nos últimos ${item.meses} meses` : (Math.round(item.vezesPorMes) <= 1 ? "Cerca de 1 vez por mês" : `Cerca de ${Math.round(item.vezesPorMes)} vezes por mês`)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink">{money(item.mensal)}/mês</p>
                  <p className="text-caption tabular-nums text-ink-faint">{m(item.anual)}/ano</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.tipo === "assinatura" ? botao("raiox_cancelar", t.raioxCancelar) : botao("raiox_metade", t.raioxMetade)}
                {botao("raiox_manter", t.raioxManter)}
              </div>
            </div>
          );
        })}
      </Card>
      {economia > 0 && <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-ink">{t.raioxEconomia(m(economia), m(valorFuturo(economia / 12, 60)))}</p>}
      <p className="px-1 text-caption text-ink-faint">
        Como achei: o mesmo estabelecimento, em pelo menos 3 meses diferentes. Moradia, saúde, educação e impostos ficam de fora. Rendimento de referência: 0,9% ao mês.
      </p>
    </div>
  );
}
