import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { lerResetConferido } from "@/lib/repositories/money-reset.repo";
import { MARCOS, SEMANAS, marco, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { vozDoTema } from "@/lib/profiles/voice";
import { MapaDoReset } from "@/components/money-reset/MapaDoReset";
import { IconeDoMarco } from "@/components/money-reset/IconeDoMarco";
import { Placar } from "@/components/money-reset/Placar";

/**
 * Money Reset, versão A+B (12/10/2026): o mapa de 21 marcos em 3 semanas, com o placar "Achei
 * R$ X por mês" no alto e o cartão da missão de agora embaixo. Só quem comprou (ou a Dani) entra;
 * para os outros a página nem existe, de propósito (ninguém se sente cobrado dentro do app).
 */
export default async function MoneyResetPage() {
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) notFound();
  const reset = await lerResetConferido(ctx);
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const { estado } = reset;
  const atual = estado.atual ? marco(estado.atual) : null;
  const titulos = MARCOS.map((m) => naVoz(m.t, v));
  // Semana 2 e 3 abrem com a história da Lu (uma vez, mesmo que o primeiro marco tenha contado
  // sozinho); a da semana 1 fica no atalho, porque ali o extrato vem primeiro.
  const historiaPendente = !!atual && atual.semana > 1 && !reset.respostas[`historia${atual.semana}` as const];
  const semana = SEMANAS[(atual?.semana ?? 3) - 1];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.mrTopo}</p>
      <Placar porMes={reset.achei} />
      <MapaDoReset status={estado.status} semana={estado.semana} titulos={titulos} admin={ctx.role === "ADMIN"} historias />

      {atual && (
        <div className="flex flex-col gap-3">
          <Link href={historiaPendente ? `/money-reset/semana/${atual.semana}` : `/money-reset/dia/${atual.n}`} className="glass flex items-center gap-3 rounded-2xl px-3 py-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
              {historiaPendente ? <BookOpen size={22} strokeWidth={1.9} aria-hidden /> : <IconeDoMarco icone={atual.icone} size={22} />}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-ink">{historiaPendente ? semana.historia : `${atual.n}. ${titulos[atual.n - 1]}`}</b>
              <small className="block text-[13px] text-ink-muted">{historiaPendente ? `${t.mrHistoriaDe(atual.semana, semana.nome)} · 1 min` : `${t.mrAgora} · ${t.mrMinutos(atual.min)} · ${naVoz(atual.sub, v)}`}</small>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
          </Link>
          <Link
            href={historiaPendente ? `/money-reset/semana/${atual.semana}` : `/money-reset/dia/${atual.n}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm"
          >
            {historiaPendente ? t.mrAbrirHistoria : t.mrComecarMissao(atual.n)}
          </Link>
          <p className="text-center text-caption text-ink-muted">{t.mrRitmo}</p>
        </div>
      )}

      {estado.fase === "concluido" && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-body font-semibold text-ink">{t.mrConcluido}</p>
          <Link href="/money-reset/dia/21" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm">
            {t.mrCartaoFrase}
          </Link>
        </div>
      )}
    </div>
  );
}
