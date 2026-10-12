"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { MapaDoReset } from "@/components/money-reset/MapaDoReset";
import { IconeDoMarco } from "@/components/money-reset/IconeDoMarco";
import { Placar } from "@/components/money-reset/Placar";
import { SEMANAS, marco, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import type { StatusDoMarco } from "@/lib/money-reset/progresso";
import type { DadosDoMarco } from "../../dados";
import { TelaDoMarco } from "./TelaDoMarco";
import { CartaoFinal } from "./CartaoFinal";

export type Respostas = Record<string, { texto: string; dados: unknown }>;

/** Os marcos que mexem no placar desenham o placar deles (ele muda ao vivo enquanto ela decide). */
const PLACAR_PROPRIO = new Set([3, 4]);

/**
 * A missão, como na proposta A+B: o topo "Missão N de 21 · Semana", o título, o placar e a
 * missão em si (TelaDoMarco). Feita, vira "o app reage": quanto ela achou, o que já mudou no SPI,
 * o mapa pequeno e "a próxima já abriu; o ideal é amanhã, mas se quiser, a gente segue agora".
 */
export function Missao({
  n,
  status,
  admin,
  dados,
  respostas,
  achei,
  atual,
  historiaAntes,
  feitaHoje,
  mapa,
  hoje,
  amanha,
}: {
  n: number;
  status: StatusDoMarco;
  admin: boolean;
  dados: DadosDoMarco;
  respostas: Respostas;
  achei: number;
  atual: number | null;
  historiaAntes: number | null;
  feitaHoje: boolean;
  mapa: { status: Record<number, StatusDoMarco>; semana: 1 | 2 | 3; titulos: string[] };
  hoje: string;
  amanha: string;
}) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  const m = marco(n)!;
  const semana = SEMANAS[m.semana - 1];
  const feita = status === "feito";
  const [vendo, setVendo] = useState<"missao" | "reagiu">(feita ? "reagiu" : "missao");

  const topo = (rotulo: string) => (
    <div className="flex items-center gap-2">
      <Link href="/money-reset" aria-label={t.mrVerMapa} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
        <ArrowLeft size={18} />
      </Link>
      <span className="min-w-0 text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{rotulo}</span>
    </div>
  );

  if (status === "fechado" && !admin) {
    return (
      <div className="flex flex-col gap-5">
        {topo(t.mrMissaoDe(n, semana.nome))}
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
            <Lock size={22} aria-hidden />
          </span>
          <p className="text-body font-semibold text-ink">{naVoz(m.t, v)}</p>
          <p className="text-caption text-ink-muted">Abre quando você chegar lá</p>
        </div>
      </div>
    );
  }

  // O fim do mapa: o cartão "Organizei meu dinheiro em 21 dias".
  if (n === 21 && vendo === "reagiu" && dados.n === 21) {
    return (
      <div className="flex flex-col gap-4">
        {topo("21 de 21")}
        <MapaDoReset status={mapa.status} semana={3} titulos={mapa.titulos} mini />
        <CartaoFinal dados={dados as Extract<DadosDoMarco, { n: 21 }>} achei={achei} />
        <button type="button" onClick={() => setVendo("missao")} className="min-h-11 text-sm font-semibold text-ink-muted">
          {t.mrVerDeNovo}
        </button>
      </div>
    );
  }

  if (vendo === "reagiu") {
    const proxima = atual !== null && atual !== n ? marco(atual)! : null;
    const destino = historiaAntes ? `/money-reset/semana/${historiaAntes}` : proxima ? `/money-reset/dia/${proxima.n}` : "/money-reset";
    const achou = PLACAR_PROPRIO.has(n) && achei > 0;
    return (
      <div className="flex flex-col gap-4">
        {topo(t.mrFeita(n))}
        <HeroiDoTema className="mr-entra">
          {achou ? (
            <>
              <small className="text-[13px] font-semibold text-heroi-suave">{t.mrAchou}</small>
              <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums">{money(achei, { round: true })}</span>
              <small className="text-[13px] font-semibold text-heroi-suave">{t.mrNoAno(money(achei * 12, { round: true }))}</small>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="heroi-veu flex size-14 shrink-0 items-center justify-center rounded-2xl">
                <IconeDoMarco icone={m.icone} size={26} />
              </span>
              <div className="min-w-0">
                <small className="block text-[13px] font-semibold text-heroi-suave">{t.mrFeita(n)}</small>
                <b className="block text-[19px] font-bold leading-tight">{naVoz(m.t, v)}</b>
              </div>
            </div>
          )}
        </HeroiDoTema>

        <div className="glass flex flex-col gap-2.5 rounded-2xl p-4">
          <p className="text-[15px] font-semibold text-ink">{t.mrMudou}</p>
          {m.mudou.map((x, i) => (
            <p key={x} className="mr-entra flex items-center gap-2.5 text-[14px] text-ink" style={{ animationDelay: `${150 + i * 120}ms` }}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check size={13} strokeWidth={3} aria-hidden />
              </span>
              {naVoz(x, v)}
            </p>
          ))}
        </div>

        <MapaDoReset status={mapa.status} semana={mapa.semana} titulos={mapa.titulos} mini />

        {proxima ? (
          <>
            <div className="flex items-start gap-2.5">
              <span className="mr-dani" aria-hidden />
              <p className="rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2 text-[14px] text-ink">{feitaHoje ? t.mrProximaAbriu(proxima.n) : t.mrProximaEspera(proxima.n)}</p>
            </div>
            <Link href={destino} className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm">
              {t.mrContinuar}
            </Link>
            <Link href="/money-reset" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-semibold text-ink">
              {t.mrDeixarAmanha}
            </Link>
          </>
        ) : (
          <Link href="/money-reset" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm">
            {t.mrVerMapa}
          </Link>
        )}
        <button type="button" onClick={() => setVendo("missao")} className="min-h-11 text-sm font-semibold text-ink-muted">
          {t.mrVerDeNovo}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {topo(t.mrMissaoDe(n, semana.nome))}
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
          <IconeDoMarco icone={m.icone} size={22} />
        </span>
        <h1 className="min-w-0 text-h2 font-bold leading-tight tracking-tight text-ink">{naVoz(m.t, v)}</h1>
      </div>
      {!PLACAR_PROPRIO.has(n) && <Placar porMes={achei} />}
      <TelaDoMarco n={n} dados={dados} respostas={respostas} feita={feita} admin={admin} achei={achei} hoje={hoje} amanha={amanha} onFeita={() => setVendo("reagiu")} />
    </div>
  );
}
