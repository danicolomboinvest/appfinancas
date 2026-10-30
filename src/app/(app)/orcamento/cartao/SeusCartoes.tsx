import Link from "next/link";
import { CalendarDays, CreditCard, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LogoDoBanco } from "@/components/cartao/LogoDoBanco";
import { rotuloDoCartao } from "@/lib/cartao/bancos";
import { NomeComParcela } from "@/components/entries/NomeComParcela";
import { diaCurto, diaDoLancamento, nomeDaFatura, type Dia } from "@/lib/cartao/fatura";
import type { CartaoComFaturas } from "@/lib/repositories/cartao.repo";
import type { FaturaComTotal } from "@/lib/planning/faturas-do-cartao";
import { AcoesDoCartao } from "./AcoesDoCartao";

/**
 * "Seu cartão" (15/10/2026): cada cartão cadastrado com a fatura aberta (o número grande), a
 * fechada que ainda vai vencer, a próxima, o melhor dia para comprar e as compras da aberta. Os
 * totais vêm de lib/planning/faturas-do-cartao.ts, a soma dos lançamentos ligados ao cartão.
 */
export function SeusCartoes({ cartoes, hoje, money }: { cartoes: CartaoComFaturas[]; hoje: Dia; money: (n: number) => string }) {
  if (cartoes.length === 0)
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
            <CreditCard size={20} strokeWidth={1.8} />
          </span>
          <p className="min-w-0 text-body font-semibold text-ink">Cadastre seu cartão para ver cada fatura</p>
        </div>
        <Link href="/orcamento/cartao/novo" className="flex min-h-12 items-center justify-center rounded-full bg-ink text-[16px] font-medium text-canvas">
          Cadastrar cartão
        </Link>
      </Card>
    );

  const linhaDaFatura = (rotulo: string, f: FaturaComTotal) => (
    <li className="flex min-h-12 flex-col justify-center gap-0.5 py-2.5" data-fatura={f.chave}>
      <span className="text-caption font-semibold text-ink-muted">{rotulo}</span>
      <span className="text-[15px] text-ink">
        Fatura de {nomeDaFatura(f, hoje.ano)}: <b className="font-semibold tabular-nums">{money(f.total)}</b>, vence {diaCurto(f.vencimento)}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      {cartoes.map((c) => {
        const f = c.faturas;
        const nome = rotuloDoCartao(c);
        return (
          <section key={c.id} className="flex flex-col gap-3" aria-label={nome} data-cartao={c.id}>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <LogoDoBanco banco={c.banco} size={44} />
                <div className="min-w-0">
                  <p className="break-words text-body font-semibold text-ink">{nome}</p>
                  {c.diaFechamento && c.diaVencimento ? (
                    <p className="text-caption text-ink-muted">
                      Fecha dia {c.diaFechamento}, vence dia {c.diaVencimento}
                    </p>
                  ) : null}
                </div>
              </div>
              {f ? (
                <div>
                  <p className="text-caption font-semibold text-accent-strong">Fatura aberta</p>
                  <p className="mt-0.5 text-[2.5rem] font-light leading-tight tracking-[-0.03em] text-ink tabular-nums">{money(f.aberta.total)}</p>
                  <p className="text-sm text-ink-muted">
                    Fatura de {nomeDaFatura(f.aberta, hoje.ano)}, vence {diaCurto(f.aberta.vencimento)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink">Faltam os dias de fechamento e vencimento.</p>
              )}
            </Card>

            {f && (
              <>
                <p className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] font-medium text-ink">
                  <CalendarDays size={18} className="shrink-0 text-accent-strong" aria-hidden />
                  Melhor dia para comprar: dia {f.melhorDia}
                </p>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
                  {f.fechada && linhaDaFatura("Fechada", f.fechada)}
                  {linhaDaFatura("Aberta", f.aberta)}
                  {linhaDaFatura("Próxima", f.proxima)}
                </ul>
                {f.aberta.lancamentos.length > 0 && (
                  <details className="group rounded-2xl border border-border bg-surface">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
                      Compras da fatura de {nomeDaFatura(f.aberta, hoje.ano)}
                      <span className="shrink-0 text-sm text-ink-muted tabular-nums">{f.aberta.lancamentos.length}</span>
                    </summary>
                    <ul className="divide-y divide-border border-t border-border px-4">
                      {f.aberta.lancamentos.map((l) => {
                        const d = diaDoLancamento(l.entryDate);
                        return (
                          <li key={l.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block break-words text-sm text-ink">
                                <NomeComParcela descricao={l.description} semNome={l.rotulo || "Compra"} />
                              </span>
                              {d && <span className="block text-caption text-ink-muted">{diaCurto(d)}</span>}
                            </span>
                            <span className={`shrink-0 text-sm font-semibold tabular-nums ${l.amount < 0 ? "text-success" : "text-ink"}`}>{money(l.amount)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </>
            )}
            <AcoesDoCartao id={c.id} />
          </section>
        );
      })}
      <Link href="/orcamento/cartao/novo" className="flex min-h-12 w-fit items-center gap-2 rounded-full px-1 text-[15px] text-ink">
        <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted">
          <Plus size={16} aria-hidden />
        </span>
        Novo cartão
      </Link>
    </div>
  );
}
