"use client";

import { useState } from "react";
import { useMoney } from "@/components/money/MoneyProvider";

export type MesDoResumo = {
  rotulo: string;
  nome: string;
  planejado: number;
  gasto: number;
  realizado: boolean;
  /** As categorias que mais passaram do plano naquele mês. */
  pesaram: { label: string; valor: number }[];
};

/**
 * "Seu ano até agora" (01/10/2026): substitui a tabela "Ver dados detalhados mês a mês", 12
 * cartões altos que a Dani achou inúteis. Responde o que a tabela não respondia: no ano, gastou
 * menos ou mais que o planejado? Qual o melhor e o pior mês? E, tocando num mês, o que pesou nele.
 */
export function ResumoDoAno({ ano, meses }: { ano: number; meses: MesDoResumo[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const vividos = meses.filter((x) => x.realizado && x.planejado > 0);
  const pior = [...vividos].sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado))[0];
  const melhor = [...vividos].sort((a, b) => a.gasto - a.planejado - (b.gasto - b.planejado))[0];
  const inicial = pior && pior.gasto > pior.planejado ? pior : vividos.at(-1);
  const [escolhido, setEscolhido] = useState<string | null>(inicial?.nome ?? null);
  if (vividos.length === 0) return null;

  const diferenca = vividos.reduce((s, x) => s + x.planejado - x.gasto, 0);
  const media = vividos.reduce((s, x) => s + x.gasto, 0) / vividos.length;
  const topo = Math.max(...meses.map((x) => Math.max(x.gasto, x.planejado)), 1) * 1.08;
  const planoTipico = Math.max(...vividos.map((x) => x.planejado));
  const mes = meses.find((x) => x.nome === escolhido) ?? null;
  const bom = diferenca >= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl p-4 ${bom ? "bg-success-soft" : "bg-danger-soft"}`}>
        <p className={`text-caption ${bom ? "text-success" : "text-danger"}`}>{bom ? "No ano, você gastou menos que o planejado" : "No ano, você gastou mais que o planejado"}</p>
        <p className={`text-2xl font-semibold tabular-nums ${bom ? "text-success" : "text-danger"}`}>
          {m(Math.abs(diferenca))} {bom ? "a menos" : "a mais"}
        </p>
        <p className="text-caption text-ink-muted">
          em {vividos.length} {vividos.length === 1 ? "mês" : "meses"}
          {bom ? `. Dá ${m(diferenca / vividos.length)} por mês que podem virar guardado.` : `: ${m(-diferenca / vividos.length)} por mês acima do plano.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {melhor && <Numero rotulo="Melhor mês" valor={melhor.nome} sub={`${melhor.gasto <= melhor.planejado ? "−" : "+"}${m(Math.abs(melhor.planejado - melhor.gasto))}`} cor={melhor.gasto <= melhor.planejado ? "text-success" : "text-danger"} />}
        {pior && <Numero rotulo={pior.gasto > pior.planejado ? "Pior mês" : "Mais apertado"} valor={pior.nome} sub={`${pior.gasto > pior.planejado ? "+" : "−"}${m(Math.abs(pior.gasto - pior.planejado))}`} cor={pior.gasto > pior.planejado ? "text-danger" : "text-success"} />}
        <Numero rotulo="Média" valor={m(media)} sub="por mês" cor="text-ink-muted" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="relative flex h-28 items-end gap-1.5">
          <span className="absolute inset-x-0 border-t-2 border-dashed border-ink-faint" style={{ bottom: `${(planoTipico / topo) * 100}%` }} aria-hidden />
          {meses.map((x) => {
            const passou = x.planejado > 0 && x.gasto > x.planejado;
            const ativo = x.nome === escolhido;
            return (
              <button
                key={x.nome}
                type="button"
                disabled={!x.realizado}
                onClick={() => setEscolhido(x.nome)}
                aria-label={`${x.nome}: ${m(x.gasto)}`}
                aria-pressed={ativo}
                className="relative flex h-full flex-1 flex-col justify-end"
              >
                <span
                  className={`w-full rounded-t-md ${!x.realizado ? "bg-surface-2" : passou ? "bg-danger/75" : "bg-success/60"} ${ativo ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""}`}
                  style={{ height: x.realizado ? `${Math.max(3, (x.gasto / topo) * 100)}%` : "4%" }}
                />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 text-center text-xs text-ink-faint">
          {meses.map((x) => (
            <span key={x.nome} className={`flex-1 ${x.nome === escolhido ? "font-semibold text-ink" : ""}`}>
              {x.rotulo}
            </span>
          ))}
        </div>
      </div>

      {mes && (
        <div className="flex flex-col gap-1 rounded-2xl border border-border p-3">
          <div className="flex justify-between gap-2">
            <span className="text-sm font-semibold text-ink">{mes.nome}</span>
            <span className={`text-sm font-semibold tabular-nums ${mes.gasto > mes.planejado ? "text-danger" : "text-success"}`}>
              {mes.gasto > mes.planejado ? `passou ${m(mes.gasto - mes.planejado)}` : `sobrou ${m(mes.planejado - mes.gasto)}`}
            </span>
          </div>
          <p className="text-caption text-ink-muted">
            Gastou {m(mes.gasto)} de {m(mes.planejado)}.
            {mes.pesaram.length > 0 && <> Quem mais pesou: {mes.pesaram.map((p) => `${p.label} (+${m(p.valor)})`).join(" e ")}.</>}
          </p>
        </div>
      )}
      <p className="text-xs text-ink-faint">Toque num mês para ver o que aconteceu nele. O tracejado é o planejado do ano {ano}.</p>
    </div>
  );
}

function Numero({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub: string; cor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2 py-2.5">
      <span className="truncate text-caption text-ink-muted">{rotulo}</span>
      <span className="truncate text-sm font-semibold text-ink">{valor}</span>
      <span className={`truncate text-xs tabular-nums ${cor}`}>{sub}</span>
    </div>
  );
}
