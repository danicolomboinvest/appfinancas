"use client";

import { Explica } from "@/components/ui/Explica";

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
      {/* O total por ano e o que ele vira em 5 anos, em dois quadradinhos (07/10/2026, "mesma cara,
          menos texto"). Saíram a frase "Investidos por 5 anos, virariam cerca de", a citação e o
          "como achei" do rodapé, que agora mora no "?". */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex min-w-0 flex-col p-4">
          <p className="flex items-center gap-1.5 text-caption text-ink-muted">
            {t.raioxJuntosAno}
            <Explica>{t.raioxComoAchei}</Explica>
          </p>
          <p className="mt-1 truncate text-[22px] font-bold tabular-nums tracking-tight text-ink">{m(totalMensal * 12)}</p>
        </Card>
        <Card className="flex min-w-0 flex-col p-4">
          <p className="text-caption text-ink-muted">{t.raioxEmCincoAnos}</p>
          <p className="mt-1 truncate text-[22px] font-bold tabular-nums tracking-tight text-success">{m(valorFuturo(totalMensal, 60))}</p>
        </Card>
      </div>
      <Card className="flex flex-col divide-y divide-border px-5 py-1">
        {itens.map((item) => {
          const e = escolhas[item.chave];
          const botao = (d: Decisao, rotulo: string) => (
            <button
              type="button"
              aria-pressed={e === d}
              onClick={() => decidir(item, d)}
              className={`min-h-11 rounded-xl px-4 py-2 text-caption font-semibold transition-colors ${e === d ? "bg-accent-soft text-accent-strong ring-2 ring-accent" : d === "raiox_manter" ? "border border-border text-ink-muted" : "bg-accent-soft text-accent-strong"}`}
            >
              {rotulo}
            </button>
          );
          return (
            <div key={item.chave} className="py-4" data-guia="raiox-item">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.nome}</p>
                  <p className="text-caption text-ink-faint">
                    {item.tipo === "assinatura" ? t.raioxNosUltimos(item.meses) : t.raioxVezesPorMes(Math.round(item.vezesPorMes))}
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
    </div>
  );
}
