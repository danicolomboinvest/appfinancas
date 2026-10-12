"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import type { Pergunta } from "@/lib/analysis/quatro-perguntas";
import type { Logo } from "@/lib/analysis/analises-dados";
import { separarPrefixo, PrefixoPequeno } from "@/components/ui/ValorDestaque";
import { AnelDePerguntas, Ponto, TileDoAtivo } from "./aneis";
import { GraficoDaPergunta } from "./Graficos";

const CARTAO = "rounded-3xl border border-border bg-surface";

export type LinhaParaVoce = { rotulo: string; valor: string; detalhe?: string };

export type PropsDaCompleta = {
  ticker: string;
  /** "ITSA4 · Itaúsa" (ação) ou o nome do título (renda fixa). */
  titulo: string;
  subtitulo: string | null;
  perguntas: Pergunta[];
  logo: Logo;
  /** O preço dentro do anel ("R$ 9,85"); na renda fixa, o quanto rende. */
  centro: string | null;
  centroEhTexto?: boolean;
  /** Fonte e hora de cada número de fora ("Investidor10 · lido 11/10, 14:32"). */
  fonte: string | null;
  paraVoce: LinhaParaVoce[];
  numeros: [string, string][];
  naCarteira: boolean;
  comparaCom: string | null;
  aviso: string;
};

/**
 * A Análise completa (rodada 56: direção A com o toque da C). No topo, o anel de 4 pedaços com o
 * preço dentro e a legenda curta; tocar num pedaço ou na legenda rola até o cartão daquela pergunta.
 * "Ver uma pergunta por vez" mostra um cartão só, com setas e pontinhos. Depois, "E para você?",
 * os números recolhidos e o aviso de que não é recomendação.
 */
export function AnaliseCompleta(p: PropsDaCompleta) {
  const P = p.perguntas;
  const [hq, setHq] = useState<string | null>(null);
  const [um, setUm] = useState<number | null>(null);
  const x0 = useRef<number | null>(null);

  const tocar = (k: string) => {
    const i = P.findIndex((x) => x.k === k);
    if (um !== null) {
      setUm(i);
      return;
    }
    setHq(k);
    document.getElementById(`anq-${k}`)?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const anda = (d: number) => setUm((u) => (u === null ? u : Math.max(0, Math.min(P.length - 1, u + d))));
  const marcada = um !== null ? P[um].k : hq;

  const meio =
    um !== null ? (
      <>
        <small className="text-xs text-ink-muted tabular-nums">{um + 1} de {P.length}</small>
        <b className="mt-1 max-w-[150px] text-[19px] font-medium leading-tight text-ink">{P[um].r}</b>
      </>
    ) : (
      <>
        <TileDoAtivo ticker={p.ticker} logo={p.logo} tamanho={36} />
        {p.centro && (p.centroEhTexto ? <b className="mt-2 max-w-[140px] text-[17px] font-medium leading-tight text-ink">{p.centro}</b> : <Preco texto={p.centro} />)}
      </>
    );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/fichas" className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm text-ink-muted">
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
          Análises
        </Link>
        {p.fonte && <span className="text-right text-xs text-ink-muted">{p.fonte}</span>}
      </div>

      <div className="flex flex-col items-center gap-3">
        <AnelDePerguntas
          forcas={P.map((x) => x.f)}
          chaves={P.map((x) => x.k)}
          tamanho={210}
          espessura={13}
          selecionada={marcada}
          onToque={tocar}
          meio={meio}
          rotulo={`${p.titulo}: ${P.map((x) => `${x.q} ${x.r}`).join(". ")}`}
        />
        <p className="text-center text-[15px] text-ink">
          <b className="font-semibold">{p.titulo}</b>
          {p.subtitulo && <span className="text-ink-muted"> · {p.subtitulo}</span>}
        </p>
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">
          {P.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => tocar(x.k)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] ${marcada === x.k ? "bg-surface-2 text-ink" : "text-ink-muted"}`}
            >
              <Ponto f={x.f} tamanho={7} />
              {x.curto}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setUm((u) => (u === null ? 0 : null))} className="min-h-11 px-2 text-[13px] text-ink-muted">
          {um !== null ? "Todas de uma vez" : "Uma pergunta por vez"}
        </button>
      </div>

      {um !== null ? (
        <div
          className="flex flex-col gap-3"
          onPointerDown={(e) => (x0.current = e.clientX)}
          onPointerUp={(e) => {
            if (x0.current === null) return;
            const dx = e.clientX - x0.current;
            x0.current = null;
            if (Math.abs(dx) > 50) anda(dx < 0 ? 1 : -1);
          }}
        >
          <CartaoDaPergunta x={P[um]} destaque={false} />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => anda(-1)} disabled={um === 0} aria-label="Pergunta anterior" className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
              <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
            </button>
            <span className="flex gap-1.5" aria-hidden>
              {P.map((_, i) => (
                <i key={i} className="block size-1.5 rounded-full" style={{ background: "var(--color-accent)", opacity: i === um ? 0.9 : 0.25 }} />
              ))}
            </span>
            <button type="button" onClick={() => anda(1)} disabled={um === P.length - 1} aria-label="Próxima pergunta" className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
              <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        P.map((x) => <CartaoDaPergunta key={x.k} x={x} destaque={hq === x.k} />)
      )}

      {p.paraVoce.length > 0 && (
        <div className={`${CARTAO} px-4 pb-1 pt-4`}>
          <b className="text-[15px] font-medium text-ink">E para você?</b>
          <dl className="mt-2 flex flex-col">
            {p.paraVoce.map((l) => (
              <div key={l.rotulo} className="flex flex-col gap-0.5 border-t border-border py-3">
                <dt className="text-xs text-ink-muted">{l.rotulo}</dt>
                <dd className="text-[17px] font-semibold text-ink">{l.valor}</dd>
                {l.detalhe && <dd className="text-xs text-ink-muted">{l.detalhe}</dd>}
              </div>
            ))}
          </dl>
        </div>
      )}

      {p.numeros.length > 0 && (
        <details className={`${CARTAO} group px-4`}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[15px] font-medium text-ink">
            Ver os números
            <ChevronDown size={16} strokeWidth={1.8} className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid grid-cols-2 gap-2 pb-4">
            {p.numeros.map(([t, v]) => (
              <div key={t} className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
                <small className="text-xs text-ink-muted">{t}</small>
                <b className="truncate text-[15px] font-semibold text-ink tabular-nums">{v}</b>
              </div>
            ))}
          </div>
        </details>
      )}

      {!p.naCarteira && (
        <Link href="/carteira" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent">
          <Plus size={16} strokeWidth={2} aria-hidden />
          Adicionar à carteira
        </Link>
      )}
      {p.comparaCom && (
        <Link href={`/fichas/comparar?a=${p.ticker}&b=${p.comparaCom}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-[15px] font-medium text-ink">
          <Repeat size={16} strokeWidth={1.8} aria-hidden />
          Comparar com {p.comparaCom}
        </Link>
      )}
      <p className="px-2 text-center text-xs leading-relaxed text-ink-muted">Não é recomendação. {p.aviso}</p>
    </div>
  );
}

function Preco({ texto }: { texto: string }) {
  const [prefixo, numero] = separarPrefixo(texto);
  return (
    <b className="mt-2 inline-flex items-baseline text-[2.5rem] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">
      {prefixo && <PrefixoPequeno>{prefixo}</PrefixoPequeno>}
      {numero}
    </b>
  );
}

function CartaoDaPergunta({ x, destaque }: { x: Pergunta; destaque: boolean }) {
  return (
    <div id={`anq-${x.k}`} className={`${CARTAO} flex flex-col gap-3 p-4 transition-shadow ${destaque ? "ring-2 ring-[color-mix(in_srgb,var(--color-ink)_22%,transparent)]" : ""}`}>
      <div className="flex flex-col gap-1">
        <span className="flex items-start gap-2 text-[13px] leading-snug text-ink-muted">
          <span className="flex h-[1.375em] shrink-0 items-center"><Ponto f={x.f} tamanho={7} /></span>
          {x.q}
        </span>
        <b className="text-xl font-medium leading-snug text-ink">{x.r}</b>
      </div>
      {x.graficos.map((g, i) => (
        <GraficoDaPergunta key={i} g={g} />
      ))}
      {(x.notas.length > 0 || (x.num && x.graficos.length === 0)) && (
        <p className="flex flex-col gap-0.5 text-xs leading-relaxed text-ink-muted">
          {x.graficos.length === 0 && x.num && <span className="text-[13px] text-ink">{x.num}</span>}
          {x.notas.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </p>
      )}
    </div>
  );
}
