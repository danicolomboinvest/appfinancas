import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AuthContext } from "@/lib/auth/session";
import type { NivelDoLimite } from "@/lib/cartao/limite";
import { situacaoDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { serverMoney } from "@/lib/money-server";
import { nowInBrazil } from "@/lib/date/brazil-now";

/** Verde até 70%, o destaque do tema (dourado no Padrão) até 90%, vermelho dali em diante. */
const COR_DA_BARRA: Record<NivelDoLimite, string> = {
  ok: "bg-success",
  atencao: "bg-accent",
  perto: "bg-danger",
  passou: "bg-danger",
};

/**
 * O limite do cartão no mês (06/10/2026): quanto falta, quanto já foi e a barra. No Foco é um
 * atalho para a tela do limite; na tela, fica sem link. Some quando o perfil não tem limite.
 */
export async function CartaoDoLimite({ ctx, comLink = true }: { ctx: AuthContext; comLink?: boolean }) {
  const agora = nowInBrazil();
  const situacao = await situacaoDoCartao(ctx, agora.getFullYear(), agora.getMonth() + 1);
  if (!situacao) return null;
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const money = await serverMoney();
  const nomeDoMes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const passou = situacao.nivel === "passou";

  const conteudo = (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-4">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${passou ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong"}`}
          aria-hidden
        >
          <CreditCard size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.limDoMes(nomeDoMes)}</p>
          <p className={`mt-0.5 text-h2 font-bold tracking-tight ${passou ? "text-danger" : "text-ink"}`}>
            {passou ? t.limPassou(money(-situacao.falta)) : t.limFalta(money(situacao.falta))}
          </p>
          <p className="text-caption text-ink-muted">{t.limGastoDe(money(situacao.gasto), money(situacao.limite))}</p>
        </div>
        {comLink && <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />}
      </div>
      <div
        role="progressbar"
        aria-label={t.limTitulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, situacao.pct))}
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className={`h-full rounded-full ${COR_DA_BARRA[situacao.nivel]}`} style={{ width: `${Math.max(2, Math.min(100, situacao.pct))}%` }} />
      </div>
      {situacao.nivel !== "ok" && <p className={`text-caption ${passou || situacao.nivel === "perto" ? "text-danger" : "text-ink-muted"}`}>{t.limNivel[situacao.nivel]}</p>}
    </Card>
  );

  return comLink ? (
    <Link href="/orcamento/cartao" className="block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
