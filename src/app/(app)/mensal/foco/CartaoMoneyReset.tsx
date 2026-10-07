import Link from "next/link";
import type { AuthContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { conferirMissaoDoDia, lerReset } from "@/lib/repositories/money-reset.repo";
import { missao, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { vozDoTema, type Titulos } from "@/lib/profiles/voice";
import { AnelDoReset } from "@/app/(app)/money-reset/AnelDoReset";

/**
 * Money Reset no Foco (05/10/2026): a missão de hoje, para quem comprou. Quem não comprou não vê
 * nada (decisão da Dani: nada de oferta nem cobrança dentro do app). Some quando os 21 dias acabam.
 */
export async function CartaoMoneyReset({ ctx, t }: { ctx: AuthContext; t: Titulos }) {
  if (!(await temMoneyReset(ctx.userId))) return null;
  let reset = await lerReset(ctx);
  if (await conferirMissaoDoDia(ctx, reset)) reset = await lerReset(ctx);
  const { estado } = reset;
  if (estado.fase === "concluido") return null;
  const v = vocabularioDaVoz(vozDoTema(ctx.profileTheme, ctx.profileKind));
  const m = estado.atual ? missao(estado.atual) : null;

  if (estado.fase === "dia0") {
    return (
      <Link href="/money-reset">
        <Card className="flex items-center gap-4 p-5">
          <AnelDoReset feitas={0} />
          <span className="min-w-0 flex-1">
            <span className="block text-caption font-semibold text-accent-strong">{t.mrFocoEy}</span>
            <span className="mt-0.5 block text-body font-semibold text-ink">{t.mrBoas}</span>
            <span className="mt-0.5 block text-caption text-ink-muted">{t.mrBoasSub}</span>
          </span>
        </Card>
      </Link>
    );
  }

  if (!m) return null;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-4">
        <AnelDoReset feitas={estado.feitas} />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-accent-strong">
            {t.mrFocoEy}, {estado.disponivel ? t.mrMissaoDeHoje : t.mrProxima}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-body font-semibold text-ink">
            <span aria-hidden>{m.ic}</span>
            <span className="truncate">{naVoz(m.t, v)}</span>
          </p>
          <p className="text-caption text-ink-muted">
            {t.mrDia(m.d)}, {t.mrMinutos(m.min)}
          </p>
        </div>
      </div>
      {estado.disponivel ? (
        <Link href={`/money-reset/dia/${m.d}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm">
          {t.mrComecar}
        </Link>
      ) : (
        <Link href="/money-reset" className="inline-flex min-h-11 items-center justify-center text-caption font-semibold text-accent-strong">
          {t.mrVerTrilha}
        </Link>
      )}
    </Card>
  );
}
