"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, RefreshCcw, SlidersHorizontal } from "lucide-react";
import type { StrategyAssetClass } from "@prisma/client";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import { salvarEstrategiaAction } from "./actions";
import { NOME_DA_LINHA, NOME_DO_PERFIL, ORDEM_DAS_LINHAS } from "./nomes";
import { ProximosAportes, type DadosDosProximosAportes } from "./ProximosAportes";

/** O trilho vazio e a meta, na cor da classe (nada de cinza neutro nos gráficos). */
export const trilho = (c: StrategyAssetClass) => `color-mix(in srgb, ${STRATEGY_ASSET_CLASS_COLOR[c]} 12%, var(--color-surface))`;
export const metaClara = (c: StrategyAssetClass) => `color-mix(in srgb, ${STRATEGY_ASSET_CLASS_COLOR[c]} 40%, var(--color-surface))`;

type Linha = { classe: StrategyAssetClass; hoje: number; meta: number };

/**
 * A frase do topo (protótipo): "Tudo no lugar", "Quase tudo no lugar" ou a classe mais fora
 * ("Exterior acima da meta"). Fora da meta = mais de 2 pontos (a régua de sempre, strategy.ts).
 */
export function fraseDaEstrategia(linhas: Linha[]): string {
  const fora = linhas.filter((l) => Math.abs(l.hoje - l.meta) * 100 > 2).sort((a, b) => Math.abs(b.hoje - b.meta) - Math.abs(a.hoje - a.meta));
  if (fora.length === 0) return "Tudo no lugar";
  if (fora.length <= 2 && Math.abs(fora[0].hoje - fora[0].meta) * 100 < 6) return "Quase tudo no lugar";
  const nome = fora[0].classe === "EXTERIOR" ? "Exterior" : NOME_DA_LINHA[fora[0].classe];
  return `${nome} ${fora[0].hoje < fora[0].meta ? "abaixo" : "acima"} da meta`;
}

export function EstrategiaResumo({ perfil, linhas, proximos }: { perfil: string | null; linhas: Linha[]; proximos: DadosDosProximosAportes }) {
  const [editando, setEditando] = useState(false);
  const visiveis = ORDEM_DAS_LINHAS.map((c) => linhas.find((l) => l.classe === c)!).filter((l) => l && (l.classe !== "OUTROS" || l.hoje > 0 || l.meta > 0));
  return (
    <div className="flex flex-col gap-5">
      <HeroiDoTema>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] text-heroi-suave">Seu perfil</p>
          <Explica noHeroi>A estratégia diz quanto da carteira vai em cada tipo de investimento. Fora da meta é quando um tipo passa 2 pontos para cima ou para baixo. Ela não manda vender nada: serve para decidir onde pôr o próximo aporte.</Explica>
        </div>
        <p className="titulo-tema text-[34px] font-light leading-none">{perfil ? NOME_DO_PERFIL[perfil] ?? "Sua estratégia" : "Sua estratégia"}</p>
        <p className="text-[15px]">{fraseDaEstrategia(linhas)}</p>
      </HeroiDoTema>

      <section className="glass rounded-3xl p-4" aria-label="Hoje e meta">
        <div className="flex items-center gap-4 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-1 w-4 rounded-full bg-ink" /> hoje
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-1.5 w-4 rounded-full border border-ink" /> meta, mais clara
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-3.5">
          {visiveis.map((l) => (
            <li key={l.classe} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-ink">{l.classe === "EXTERIOR" ? "Exterior (fora do Brasil)" : NOME_DA_LINHA[l.classe]}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">
                  {Math.round(l.hoje * 100)}% hoje · meta {Math.round(l.meta * 100)}%
                </span>
              </div>
              {/* Sem cinza nos gráficos (regra da Dani): o trilho é um tom suave da cor da classe e a
                  meta é a mesma cor, mais clara. */}
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: trilho(l.classe) }}>
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, l.hoje * 200)}%`, background: STRATEGY_ASSET_CLASS_COLOR[l.classe] }} />
              </span>
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: trilho(l.classe) }}>
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, l.meta * 200)}%`, background: metaClara(l.classe) }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-muted">A escala vai até 50% da carteira.</p>
      </section>

      <ProximosAportes dados={proximos} />

      {editando ? (
        <Personalizar inicial={Object.fromEntries(linhas.map((l) => [l.classe, Math.round(l.meta * 100)])) as Record<StrategyAssetClass, number>} onFechar={() => setEditando(false)} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEditando(true)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            <SlidersHorizontal size={16} /> Personalizar
          </button>
          <Link href="/carteira/estrategia?montar=1" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            <RefreshCcw size={16} /> Refazer
          </Link>
        </div>
      )}
    </div>
  );
}

/** Personalizar: de 5 em 5 pontos, com a soma à vista; só salva quando fecha 100. */
export function Personalizar({ inicial, onFechar, perfil = "personalizado" }: { inicial: Record<StrategyAssetClass, number>; onFechar: () => void; perfil?: string }) {
  const [alvo, setAlvo] = useState(inicial);
  const [pendente, start] = useTransition();
  const erro = useErroNoBotao();
  const router = useRouter();
  const soma = ORDEM_DAS_LINHAS.reduce((s, c) => s + (alvo[c] ?? 0), 0);
  const muda = (c: StrategyAssetClass, d: number) => setAlvo({ ...alvo, [c]: Math.max(0, Math.min(100, (alvo[c] ?? 0) + d)) });
  return (
    <section className="glass flex flex-col gap-1 rounded-3xl p-4" aria-label="Personalizar">
      <p className="text-[16px] font-medium text-ink">Personalizar</p>
      {ORDEM_DAS_LINHAS.map((c) => (
        <div key={c} className="flex items-center gap-3 border-t border-border py-2 first-of-type:border-t-0">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[c] }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{NOME_DA_LINHA[c]}</span>
          <button type="button" onClick={() => muda(c, -5)} aria-label={`Menos 5 pontos em ${NOME_DA_LINHA[c]}`} className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Minus size={16} />
          </button>
          <span className="w-11 text-center text-[15px] font-medium tabular-nums text-ink">{alvo[c] ?? 0}%</span>
          <button type="button" onClick={() => muda(c, 5)} aria-label={`Mais 5 pontos em ${NOME_DA_LINHA[c]}`} className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Plus size={16} />
          </button>
        </div>
      ))}
      <p className={`mt-1 flex items-center gap-1.5 text-[14px] ${soma === 100 ? "text-success" : "text-danger"}`}>
        {soma === 100 ? <Check size={15} /> : null}
        {soma === 100 ? "Soma 100%" : soma > 100 ? `Passou ${soma - 100} pontos` : `Faltam ${100 - soma} pontos`}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={soma !== 100 || pendente}
          onClick={() => {
            erro.limpar();
            start(async () => {
              const r = await salvarEstrategiaAction(alvo, perfil);
              if (!r.ok) return erro.falhou(r.erro ?? "Não salvou");
              // Sem aviso (14/10/2026): a estratégia salva é a tela que abre.
              onFechar();
              router.push("/carteira/estrategia");
              router.refresh();
            });
          }}
          className={`min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-40 ${erro.classe}`}
        >
          {erro.erro ? TENTAR_DE_NOVO : "Salvar estratégia"}
        </button>
        <ErroNoBotao erro={erro.erro} />
        <button type="button" onClick={onFechar} className="min-h-12 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
          Cancelar
        </button>
      </div>
    </section>
  );
}
