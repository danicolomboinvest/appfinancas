import { getRequiredSession } from "@/lib/auth/session";
import { listarGastosNoCartao, lerLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { serverMoney } from "@/lib/money-server";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { CartaoDoLimite } from "@/components/cartao/CartaoDoLimite";
import { FormDoLimite } from "./FormDoLimite";

/**
 * Limite do cartão (06/10/2026): quanto ela combinou gastar no cartão por mês, quanto falta e o que
 * já foi no cartão neste mês. Cliente autônoma, renda variável: o cartão é o ponto fraco.
 */
export default async function LimiteDoCartaoPage() {
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const [limite, gastos, money] = await Promise.all([
    lerLimiteDoCartao(ctx),
    listarGastosNoCartao(ctx, agora.getFullYear(), agora.getMonth() + 1),
    serverMoney(),
  ]);
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-ink">{t.limTitulo}</h1>
        <p className="mt-1.5 text-body text-ink-muted">{t.limSub}</p>
      </div>

      <CartaoDoLimite ctx={ctx} comLink={false} />
      <FormDoLimite limite={limite} />

      <section className="flex flex-col">
        <h2 className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.limListaTitulo}</h2>
        {gastos.length === 0 ? (
          <div className="mt-1 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-ink">{t.limVazio}</p>
            <p className="mt-1 text-caption text-ink-muted">{t.limComoMarcar}</p>
          </div>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface px-4">
              {gastos.map((g) => (
                <li key={g.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{g.description || g.subcategory || t.uiTipoGasto}</span>
                    {/* A data é só o dia (@db.Date, meia-noite UTC): lida pelo texto, sem fuso, como no mês. */}
                    {g.entryDate && (
                      <span className="block text-caption text-ink-muted">{`${g.entryDate.toISOString().slice(8, 10)}/${g.entryDate.toISOString().slice(5, 7)}`}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${Number(g.amount) < 0 ? "text-success" : "text-ink"}`}>{money(Number(g.amount))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-1 text-caption text-ink-muted">{t.limComoMarcar}</p>
          </>
        )}
      </section>
    </div>
  );
}
