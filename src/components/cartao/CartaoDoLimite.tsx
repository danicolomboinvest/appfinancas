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
 * O limite do cartão no mês (06/10/2026): quanto falta, quanto já foi e a barra. Na tela do
 * limite, o cartão inteiro; no Foco, uma linha fina e discreta (`compacto`) que leva para a tela —
 * a Dani quis o limite opcional e "não principal". Some quando o perfil não tem limite.
 */
export async function CartaoDoLimite({ ctx, comLink = true, compacto = false }: { ctx: AuthContext; comLink?: boolean; compacto?: boolean }) {
  const agora = nowInBrazil();
  const situacao = await situacaoDoCartao(ctx, agora.getFullYear(), agora.getMonth() + 1);
  if (!situacao) return null;
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const money = await serverMoney();
  const nomeDoMes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const passou = situacao.nivel === "passou";
  const barra = (altura: string) => (
    <div
      role="progressbar"
      aria-label={t.limTitulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, situacao.pct))}
      className={`${altura} w-full overflow-hidden rounded-full bg-surface-2`}
    >
      <div className={`h-full rounded-full ${COR_DA_BARRA[situacao.nivel]}`} style={{ width: `${Math.max(2, Math.min(100, situacao.pct))}%` }} />
    </div>
  );

  if (compacto) {
    return (
      <Link href="/orcamento/cartao" className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-hover">
        <span className="flex min-h-6 items-center gap-2.5">
          <CreditCard size={16} strokeWidth={1.9} className={`shrink-0 ${passou ? "text-danger" : "text-accent-strong"}`} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
            {t.limDoMes(nomeDoMes)},{" "}
            <span className={`font-semibold ${passou ? "text-danger" : "text-ink"}`}>{passou ? t.limPassou(money(-situacao.falta)) : t.limFalta(money(situacao.falta))}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
        </span>
        {barra("h-1.5")}
      </Link>
    );
  }

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
          <p className="text-caption font-semibold text-accent-strong">{t.limDoMes(nomeDoMes)}</p>
          <p className={`mt-0.5 text-h2 font-bold tracking-tight ${passou ? "text-danger" : "text-ink"}`}>
            {passou ? t.limPassou(money(-situacao.falta)) : t.limFalta(money(situacao.falta))}
          </p>
          <p className="text-caption text-ink-muted">{t.limGastoDe(money(situacao.gasto), money(situacao.limite))}</p>
        </div>
        {comLink && <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />}
      </div>
      {barra("h-2.5")}
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
