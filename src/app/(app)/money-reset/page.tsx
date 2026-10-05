import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Lock } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { conferirMissaoDoDia, lerReset } from "@/lib/repositories/money-reset.repo";
import { MISSOES, SEMANAS, missao, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { vozDoTema } from "@/lib/profiles/voice";
import { Card } from "@/components/ui/Card";
import { AnelDoReset } from "./AnelDoReset";
import { Dia0 } from "./Dia0";

/**
 * Money Reset (05/10/2026): a trilha dos 21 dias. Só quem comprou (ou a Dani) entra; para os
 * outros a página nem existe, de propósito (ninguém se sente cobrado dentro do app).
 */
export default async function MoneyResetPage() {
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) notFound();
  let reset = await lerReset(ctx);
  if (await conferirMissaoDoDia(ctx, reset)) reset = await lerReset(ctx);
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const v = vocabularioDaVoz(vozDoTema(ctx.profileTheme, ctx.profileKind));
  const { estado } = reset;
  const admin = ctx.role === "ADMIN";
  const atual = estado.atual ? missao(estado.atual) : null;

  // Dia 0: só a tarefa de hoje. A trilha inteira, com cadeados, assustava (revisão da Dani).
  if (estado.fase === "dia0") return <Dia0 />;
  // A semana em que ela está fica aberta; as outras, num toque ("Ver os 21 dias").
  const semanaAtual = atual?.semana ?? 3;

  const semana = (s: (typeof SEMANAS)[number]) => (
        <section key={s.n} className="flex flex-col gap-2">
          <div className="px-1">
            <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">
              {t.mrSemana(s.n)} · {s.nome}
            </h2>
            <p className="text-caption text-ink-faint">{s.sub}</p>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {MISSOES.filter((m) => m.semana === s.n).map((m) => {
              const st = estado.status[m.d];
              const abre = st === "feita" || st === "hoje" || admin;
              const conteudo = (
                <>
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${st === "feita" ? "bg-success/15" : st === "hoje" ? "bg-accent-soft" : "bg-surface-2"}`} aria-hidden>
                    {st === "feita" ? <Check size={18} className="text-success" strokeWidth={2.5} /> : st === "bloqueada" || st === "amanha" ? <span className="opacity-60">{m.ic}</span> : m.ic}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption text-ink-faint">{t.mrDia(m.d)}</span>
                    <span className={`block truncate text-sm font-semibold ${st === "bloqueada" ? "text-ink-muted" : "text-ink"}`}>{naVoz(m.t, v)}</span>
                  </span>
                  {st === "hoje" ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-semibold text-accent-strong">{t.mrHoje}</span>
                  ) : st === "amanha" ? (
                    <span className="shrink-0 text-caption text-ink-faint">{t.mrAbreAmanha}</span>
                  ) : st === "bloqueada" && !admin ? (
                    <Lock size={14} className="shrink-0 text-ink-faint" aria-label={t.mrBloqueada} />
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                  )}
                </>
              );
              return (
                <li key={m.d}>
                  {abre ? (
                    <Link href={`/money-reset/dia/${m.d}`} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <AnelDoReset feitas={estado.feitas} tamanho={64} />
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.mrTitulo}</p>
          <h1 className="text-h2 font-bold tracking-tight text-ink">{t.mrSub}</h1>
          <p className="mt-0.5 text-caption text-ink-muted">{t.mrFeitas(estado.feitas)}</p>
        </div>
      </div>

      {atual && (
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">
            {estado.disponivel ? t.mrMissaoDeHoje : t.mrProxima} · {t.mrDia(atual.d)}
          </p>
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl" aria-hidden>
              {atual.ic}
            </span>
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">{naVoz(atual.t, v)}</p>
              <p className="text-caption text-ink-muted">{t.mrMinutos(atual.min)}</p>
            </div>
          </div>
          {estado.disponivel ? (
            <Link href={`/money-reset/dia/${atual.d}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm">
              {t.mrComecar}
            </Link>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-center text-caption text-ink-muted">{estado.atual === 1 ? t.mrDia1Amanha : t.mrFocoAmanha}</p>
          )}
        </Card>
      )}

      {estado.fase === "concluido" && (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <span className="text-4xl" aria-hidden>
            🏁
          </span>
          <p className="text-body font-semibold text-ink">{t.mrConcluido}</p>
          <p className="text-caption text-ink-muted">{t.mrConcluidoSub}</p>
          <Link href="/money-reset/dia/21" className="mt-1 inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent">
            {naVoz(missao(21)!.btn, v)}
          </Link>
        </Card>
      )}

      {SEMANAS.filter((s) => s.n === semanaAtual).map(semana)}
      {estado.fase !== "concluido" && (
        <details className="rounded-2xl border border-border bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">{t.mrVerTrilha}</summary>
          <div className="flex flex-col gap-5 pb-4 pt-1">{SEMANAS.filter((s) => s.n !== semanaAtual).map(semana)}</div>
        </details>
      )}
    </div>
  );
}
