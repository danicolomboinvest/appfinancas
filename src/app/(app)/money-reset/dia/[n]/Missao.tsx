"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, PartyPopper } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Card } from "@/components/ui/Card";
import { ComoTirarExtrato } from "@/components/import/ComoTirarExtrato";
import { missao, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import type { StatusDoDia } from "@/lib/money-reset/progresso";
import { iniciarGuia } from "@/components/money-reset/guia-estado";
import type { DadosDaMissao } from "../../dados";
import { TelaDoDia } from "./TelaDoDia";

export type Respostas = Record<string, { texto: string; dados: unknown }>;

/**
 * A missão do dia, como no protótipo: primeiro a abertura curta (ícone, por quê, o que ter em
 * mãos, o caminho de toques) e o botão "Começar, eu te guio". Nos dias de tela própria (o
 * retrato, o motivo, a regra do cartão...) o botão abre a tela; nos outros, liga o guia que
 * ilumina os botões de verdade do app, tela por tela.
 */
export function Missao({ dia, status, proxima, dados, respostas, amanha, hoje }: { dia: number; status: StatusDoDia; proxima: string | null; dados: DadosDaMissao; respostas: Respostas; amanha: string; hoje: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const m = missao(dia)!;
  const [aberta, setAberta] = useState(false);
  const feita = status === "feita";
  const fechada = status === "bloqueada" || status === "amanha";

  const topo = (
    <div className="flex items-center gap-2">
      <Link href="/money-reset" aria-label={t.mrVerTrilha} className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
        <ArrowLeft size={18} />
      </Link>
      <span className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">
        {t.mrDia(dia)} · {t.mrSemana(m.semana)}
      </span>
    </div>
  );

  if (fechada) {
    return (
      <div className="flex flex-col gap-5">
        {topo}
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Lock size={22} className="text-ink-faint" />
          <p className="text-body font-semibold text-ink">{naVoz(m.t, v)}</p>
          <p className="text-caption text-ink-muted">{status === "amanha" ? t.mrFocoAmanha : t.mrBloqueada}</p>
        </Card>
      </div>
    );
  }

  if (aberta && m.destino.tipo === "tela") {
    return (
      <div className="flex flex-col gap-4">
        {topo}
        <TelaDoDia dia={dia} dados={dados} respostas={respostas} feita={feita} amanha={amanha} hoje={hoje} onVoltar={() => setAberta(false)} />
      </div>
    );
  }

  // A abertura enxuta (revisão da Dani: "não quero que a pessoa se sinta perdida"): o porquê numa
  // frase, o que ter em mãos, o caminho de toques e o botão. O resto fica em "Precisa de ajuda?".
  return (
    <div className="flex flex-col gap-4">
      {topo}

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-accent-soft text-4xl" aria-hidden>
          {m.ic}
        </span>
        <h1 className="text-h2 font-bold tracking-tight text-ink">{naVoz(m.t, v)}</h1>
        <p className="max-w-xs text-sm text-ink-muted">{naVoz(m.por, v)}</p>
        <p className="text-caption text-ink-faint">{t.mrMinutos(m.min)}</p>
      </div>

      {feita && (
        <Card className="flex items-start gap-3 border-success/40 p-4">
          <PartyPopper size={20} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-ink">{t.mrFeita}</p>
            <p className="text-caption text-ink-muted">{proxima ? t.mrAmanha(naVoz(proxima, v)) : t.mrConcluidoSub}</p>
          </div>
        </Card>
      )}

      {m.precisa && (
        <div className="rounded-2xl bg-accent-soft px-4 py-3">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.mrPrecisa}</p>
          <p className="mt-0.5 text-sm text-ink">{m.precisa}</p>
        </div>
      )}

      {/* O caminho de toques, visual: o que ela vai apertar, na ordem. */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-2">
        {m.toques.map((toque, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-faint">›</span>}
            <span className="rounded-full border border-border-strong bg-surface px-2.5 py-1 text-caption font-semibold text-ink">{naVoz(toque, v)}</span>
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => (m.destino.tipo === "guia" ? iniciarGuia(dia) : setAberta(true))}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm"
      >
        {feita ? naVoz(m.btn, v) : m.destino.tipo === "guia" ? t.mrGuiar : naVoz(m.btn, v)}
      </button>

      <details className="rounded-2xl border border-border bg-surface px-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-muted">{t.mrAjuda}</summary>
        <div className="flex flex-col gap-3 pb-4">
          <ol className="flex flex-col gap-1.5">
            {m.passos.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-bold text-ink-muted">{i + 1}</span>
                {naVoz(p, v)}
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted">
            <b className="text-ink">{t.mrSozinho}:</b> {naVoz(m.sozinho, v)}
          </p>
          {m.travou && (
            <p className="text-sm text-ink-muted">
              <b className="text-ink">{t.mrTravou}</b> {naVoz(m.travou, v)}
            </p>
          )}
          {(dia === 1 || dia === 2 || dia === 20) && <ComoTirarExtrato />}
        </div>
      </details>
    </div>
  );
}
