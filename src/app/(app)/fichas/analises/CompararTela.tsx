"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { numBR, quemVaiMelhor, type GrupoComparar, type LinhaComparar, type Pergunta } from "@/lib/analysis/quatro-perguntas";
import type { Logo } from "@/lib/analysis/analises-dados";
import { AnelDePerguntas, TileDoAtivo } from "./aneis";

export type LadoDoComparar = { ticker: string; logo: Logo; perguntas: Pergunta[] };

const CARTAO = "rounded-3xl border border-border bg-surface";

function fmt(l: LinhaComparar, v: number): string {
  if (l.formato === "pct") return `${numBR(v)}%`;
  if (l.formato === "x") return `${numBR(v)}x`;
  if (v >= 1e9) return `R$ ${numBR(v / 1e9)} bi`;
  if (v >= 1e6) return `R$ ${numBR(v / 1e6, 0)} mi`;
  return `R$ ${numBR(v / 1e3, 0)} mil`;
}

/**
 * Comparar (rodada 56, direção A): os dois anéis no topo e, por pergunta, barras espelhadas a
 * partir do centro. Quem vai melhor num número fica com a barra colorida; o outro, cinza. Lado sem
 * o número diz "sem esse número". Nada de vermelho.
 */
export function CompararTela({ a, b, grupos, opcoes, frase, aviso }: { a: LadoDoComparar; b: LadoDoComparar; grupos: GrupoComparar[]; opcoes: string[]; frase: string | null; aviso: string }) {
  const router = useRouter();
  const troca = (lado: "a" | "b", tk: string) => {
    const novo = lado === "a" ? { a: tk, b: b.ticker } : { a: a.ticker, b: tk };
    router.push(`/fichas/comparar?a=${novo.a}&b=${novo.b}`);
  };
  const bem = (P: Pergunta[]) => P.filter((p) => p.f === "forte").length;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href="/fichas" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted">
        <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
        Análises
      </Link>

      <div className="flex items-start justify-center gap-2">
        {[a, b].map((l, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <AnelDePerguntas forcas={l.perguntas.map((p) => p.f)} tamanho={128} espessura={9} meio={<TileDoAtivo ticker={l.ticker} logo={l.logo} tamanho={40} />} />
            <label className="relative mt-1">
              <span className="sr-only">{i === 0 ? "Primeiro ativo" : "Segundo ativo"}</span>
              <select
                value={l.ticker}
                onChange={(e) => troca(i === 0 ? "a" : "b", e.target.value)}
                className="min-h-11 appearance-none rounded-full bg-transparent px-3 text-center text-[15px] font-semibold text-ink"
              >
                {opcoes.filter((o) => o !== (i === 0 ? b.ticker : a.ticker)).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <small className="text-xs text-ink-muted">{bem(l.perguntas)} de {l.perguntas.length} vão bem</small>
          </div>
        ))}
      </div>

      {grupos.map((g) => (
        <div key={g.q} className={`${CARTAO} flex flex-col gap-4 px-4 py-4`}>
          <b className="text-center text-[15px] font-medium text-ink">{g.q}</b>
          {g.linhas.map((l) => (
            <LinhaEspelhada key={l.rotulo} l={l} />
          ))}
        </div>
      ))}

      {frase && <p className="titulo-tema px-2 text-center text-lg leading-snug text-ink">{frase}</p>}
      <p className="flex items-center justify-center gap-2 text-xs text-ink-muted">
        <i className="block h-2 w-5 rounded-full" style={{ background: "var(--color-accent)" }} aria-hidden />
        barra colorida = vai melhor nesse número
      </p>
      <p className="px-2 text-center text-xs leading-relaxed text-ink-muted">Não é recomendação. {aviso}</p>
    </div>
  );
}

function LinhaEspelhada({ l }: { l: LinhaComparar }) {
  const mx = Math.max(Math.abs(l.a ?? 0), Math.abs(l.b ?? 0)) || 1;
  const melhor = quemVaiMelhor(l);
  const barra = (v: number, ganha: boolean, lado: "e" | "d") => (
    <span className={`flex h-2.5 min-w-0 flex-1 ${lado === "e" ? "justify-end" : "justify-start"}`}>
      <i
        className="an-barra block h-full rounded-full"
        style={{
          width: `${Math.max(6, (Math.abs(v) / mx) * 100).toFixed(1)}%`,
          background: ganha ? "var(--color-accent)" : "color-mix(in srgb, var(--color-ink) 16%, transparent)",
          transformOrigin: lado === "e" ? "right" : "left",
        }}
      />
    </span>
  );
  const falta = <span className="flex-1 text-center"><small className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">sem esse número</small></span>;
  return (
    <div className="flex flex-col gap-1.5">
      <small className="text-center text-xs text-ink-muted">{l.rotulo}</small>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-left text-[13px] text-ink tabular-nums">{l.a !== null ? fmt(l, l.a) : ""}</span>
        {l.a !== null ? barra(l.a, melhor === "a", "e") : falta}
        <i className="block h-4 w-px shrink-0 bg-border" aria-hidden />
        {l.b !== null ? barra(l.b, melhor === "b", "d") : falta}
        <span className="w-14 shrink-0 text-right text-[13px] text-ink tabular-nums">{l.b !== null ? fmt(l, l.b) : ""}</span>
      </div>
    </div>
  );
}
