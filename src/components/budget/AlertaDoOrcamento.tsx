"use client";

import { useState } from "react";
import { Tag, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { useMoney } from "@/components/money/MoneyProvider";
import { OQueFazer } from "./OQueFazer";
import type { LinhaDaCategoria } from "./CategoriasDoMes";

/**
 * O aviso do Orçamento quando uma categoria passou (protótipo aprovado): "Saúde passou R$ 67" e
 * um botão "O que fazer?" que abre a folha com os caminhos. A que mais passou vem primeiro.
 */
export function AlertaDoOrcamento({ linhas, essenciais, livre, diasRestantes, mes }: { linhas: LinhaDaCategoria[]; essenciais: string[]; livre: number | null; diasRestantes: number; mes?: string }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [aberto, setAberto] = useState(false);
  const passou = linhas.filter((l) => l.estado === "passou").sort((a, b) => a.sobra - b.sobra)[0];
  if (!passou) return null;
  const outras = linhas.filter((l) => l.estado === "passou").length - 1;
  return (
    <section className="flex flex-col gap-3 rounded-3xl p-4" style={{ background: "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))" }}>
      <p className="flex items-center gap-3 text-[16px] text-danger">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface" aria-hidden>
          <TriangleAlert size={18} strokeWidth={1.6} />
        </span>
        {passou.label} passou {m(Math.abs(passou.sobra))}
        {outras > 0 && <span className="text-sm text-ink-muted">e mais {outras}</span>}
      </p>
      <button type="button" onClick={() => setAberto(true)} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas">
        O que fazer?
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title="O que fazer?">
        <OQueFazer
          mes={mes}
          quantos={passou.maiores.reduce((s, g) => s + g.vezes, 0) || undefined}
          categoria={{ key: passou.key, label: passou.label, planejado: passou.planejado, gasto: passou.gasto + passou.aVencer }}
          categorias={linhas.map((l) => ({ key: l.key, label: l.label, planejado: l.planejado, gasto: l.gasto + l.aVencer }))}
          essenciais={essenciais}
          livre={livre}
          diasRestantes={diasRestantes}
          revisao={passou.sugestao ? { mediana: passou.sugestao.sugerido } : null}
          onFeito={() => setAberto(false)}
          oQuePesou={
            passou.maiores.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border">
                {passou.maiores.map((g) => (
                  <li key={g.descricao} className="flex items-center gap-3 py-2">
                    <LogoDoLancamento descricao={g.descricao} icon={Tag} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.descricao}</span>
                    <span className="shrink-0 text-sm tabular-nums text-ink">{m(g.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : undefined
          }
        />
      </Modal>
    </section>
  );
}
