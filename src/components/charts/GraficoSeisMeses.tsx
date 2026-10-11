"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { Explica } from "@/components/ui/Explica";
import { fraseDoGuardado, linhaDoMes, mesSelecionadoDeInicio, type MesDoGrafico } from "@/lib/consolidation/seis-meses";
import { lerSobrou } from "@/lib/consolidation/sobrou";
import { separarPrefixo } from "@/components/ui/ValorDestaque";

const ALTURA = 132;
const COR = {
  entrou: "var(--color-dinheiro-entrou)",
  gastou: "var(--color-dinheiro-gastou)",
  guardou: "var(--color-dinheiro-guardou)",
  sobrou: "var(--color-dinheiro-sobrou)",
  faltou: "var(--color-dinheiro-faltou)",
};
/** O mês em andamento: as mesmas cores mais leves e uma hachura, separado pela linha tracejada. */
const LISTRA = "repeating-linear-gradient(135deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 7px)";

/**
 * "Últimos 6 meses" (rodada 58, opção A com cores de contraste): Entrou e Gastou lado a lado,
 * o guardado em cima da barra de Gastou com 2 px de folga, e em cima de cada mês a palavra da
 * conta única (sobrou, empatou, faltou). Abre no último mês fechado; tocar em outro troca a
 * linha de baixo. As setas mostram os 6 meses de antes (até 12).
 */
export function GraficoSeisMeses({ meses12 }: { meses12: MesDoGrafico[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [janela, setJanela] = useState<0 | 1>(1);
  const meses = janela === 1 ? meses12.slice(-6) : meses12.slice(0, 6);
  const [selecionado, setSelecionado] = useState<number>(() => mesSelecionadoDeInicio(meses12.slice(-6)));
  const sel = meses[Math.min(selecionado, meses.length - 1)];
  const maximo = Math.max(1, ...meses.map((x) => Math.max(x.entrou, x.gastou + x.guardou)));
  const altura = (v: number) => Math.max(v > 0 ? 3 : 0, Math.round((v / maximo) * ALTURA));
  const frase = fraseDoGuardado(meses, m);
  const anoInicio = meses[0]?.ano;
  const anoFim = meses.at(-1)?.ano;
  const titulo = anoInicio === anoFim ? `${meses[0]?.rotulo} a ${meses.at(-1)?.rotulo} ${anoFim}` : `${meses[0]?.rotulo} ${anoInicio} a ${meses.at(-1)?.rotulo} ${anoFim}`;

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="titulo-tema text-[17px] font-medium text-ink">Últimos 6 meses</h2>
          <p className="text-caption text-ink-muted">{titulo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-label="Seis meses antes" disabled={janela === 0 || meses12.length <= 6} onClick={() => { setJanela(0); setSelecionado(5); }} className="flex size-9 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Seis meses depois" disabled={janela === 1} onClick={() => { setJanela(1); setSelecionado(mesSelecionadoDeInicio(meses12.slice(-6))); }} className="flex size-9 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronRight size={16} aria-hidden />
          </button>
          <Explica>Entrou é tudo que caiu na conta. Gastou é tudo que saiu, e o pedaço de cima é o que você guardou. Sobrou é entrou menos gastou menos guardou.</Explica>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1" role="group" aria-label="Meses">
        {meses.map((x, i) => {
          const s = lerSobrou(x.sobrou, x.situacao === "vazio");
          const on = i === selecionado;
          // Mês sem lançamento (antes de ela usar o app): sem palavra em cima, nada de "empatou".
          const palavra = x.atual ? "até agora" : s.situacao === "vazio" ? "" : s.situacao === "empatou" ? "empatou" : s.situacao;
          const cor = x.atual || s.situacao === "empatou" || s.situacao === "vazio" ? "var(--color-ink-muted)" : s.situacao === "sobrou" ? COR.sobrou : COR.faltou;
          return (
            <button
              key={`${x.ano}-${x.mes}`}
              type="button"
              onClick={() => setSelecionado(i)}
              aria-pressed={on}
              aria-label={linhaDoMes(x, m)}
              className={`flex min-w-0 flex-col items-center ${x.atual ? "border-l border-dashed border-border-strong pl-1" : ""}`}
            >
              <span className="flex h-8 flex-col items-center justify-end text-center text-xs leading-tight" style={{ color: cor }}>
                <span>{palavra}</span>
                {/* Só o número, sem o R$: em 320 px cada coluna tem uns 40 px. */}
                {!x.atual && s.situacao !== "empatou" && s.situacao !== "vazio" && <span className="tabular-nums">{separarPrefixo(m(s.valor))[1]}</span>}
              </span>
              <span className="mt-1 flex items-end justify-center gap-[3px]" style={{ height: ALTURA, opacity: x.atual ? 0.5 : 1 }}>
                <span className="w-[clamp(9px,3.2vw,15px)] rounded-t-[3px]" style={{ height: altura(x.entrou), background: x.atual ? `${LISTRA}, ${COR.entrou}` : COR.entrou }} />
                <span className="flex w-[clamp(9px,3.2vw,15px)] flex-col justify-end gap-[2px]">
                  {x.guardou > 0 && <span className="rounded-t-[3px]" style={{ height: altura(x.guardou), background: COR.guardou }} />}
                  <span className={x.guardou > 0 ? "" : "rounded-t-[3px]"} style={{ height: altura(x.gastou), background: x.atual ? `${LISTRA}, ${COR.gastou}` : COR.gastou }} />
                </span>
              </span>
              <span className={`mt-1.5 text-xs ${on ? "font-semibold text-ink" : "text-ink-muted"}`}>{x.rotulo}</span>
              <span className={`mt-0.5 size-1 rounded-full ${on ? "bg-ink" : "bg-transparent"}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COR.entrou }} aria-hidden /> Entrou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex size-2.5 flex-col gap-px overflow-hidden rounded-sm" aria-hidden>
            <span className="h-1 w-full" style={{ background: COR.guardou }} />
            <span className="flex-1" style={{ background: COR.gastou }} />
          </span>
          Gastou, com o guardado em cima
        </span>
      </div>

      {sel && <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink">{linhaDoMes(sel, m)}</p>}
      {frase && <p className="mt-3 text-sm text-ink-muted">{frase}</p>}
    </section>
  );
}
