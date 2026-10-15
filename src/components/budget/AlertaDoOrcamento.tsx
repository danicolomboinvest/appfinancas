"use client";

import { quantoPassou } from "@/lib/planning/remanejo";
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
 *
 * Respondeu na folha, o aviso daquela categoria sai na hora e passa para a próxima que passou
 * (pedido da Dani, 14/10/2026). `respondidas` vem do servidor (as respostas guardadas do mês, ver
 * resposta-ao-aviso.ts); a lista local cobre o tempo até a página recarregar.
 */
export function AlertaDoOrcamento({
  linhas,
  essenciais,
  livre,
  diasRestantes,
  mes,
  respondidas = [],
}: {
  linhas: LinhaDaCategoria[];
  essenciais: string[];
  livre: number | null;
  diasRestantes: number;
  mes?: string;
  respondidas?: string[];
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [aberto, setAberto] = useState(false);
  // Presa às linhas de agora: quando o servidor manda linhas novas (a resposta já salva, ou um
  // Desfazer), vale de novo só o que ele diz.
  const [local, setLocal] = useState<{ de: LinhaDaCategoria[]; keys: string[] }>({ de: linhas, keys: [] });
  const fora = new Set([...respondidas, ...(local.de === linhas ? local.keys : [])]);
  const passaram = linhas.filter((l) => l.estado === "passou" && !fora.has(l.key)).sort((a, b) => a.sobra - b.sobra);
  const passou = passaram[0];
  if (!passou) return null;
  const outras = passaram.length - 1;
  return (
    <section className="flex items-center gap-3 rounded-3xl py-3 pl-3 pr-3" style={{ background: "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))" }} data-alerta-orcamento>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-danger" aria-hidden>
        <TriangleAlert size={18} strokeWidth={1.6} />
      </span>
      <p className="min-w-0 flex-1 text-[15px] leading-snug text-danger">
        {passou.label} passou {m(quantoPassou({ planejado: passou.planejado, gasto: passou.gasto + passou.aVencer }))}
        {outras > 0 && <span className="block text-xs text-ink-muted">e mais {outras}</span>}
      </p>
      <button type="button" onClick={() => setAberto(true)} className="min-h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-canvas">
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
          onFeito={() => {
            setAberto(false);
            setLocal((l) => ({ de: linhas, keys: [...(l.de === linhas ? l.keys : []), passou.key] }));
          }}
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
