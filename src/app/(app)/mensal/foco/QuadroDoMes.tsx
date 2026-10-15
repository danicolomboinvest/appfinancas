import Link from "next/link";
import type { ReactNode } from "react";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { lerSobrou, mesSemLancamento, sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { guardadoDoMes } from "@/lib/consolidation/guardado";

type Resumo = { totalIncome: number; totalExpense: number; totalInvestment: number };

/**
 * "Outubro até agora" (ou "Setembro", no seletor de mês): Entrou, Gastou, Guardou e Sobrou, com a
 * mesma conta do gráfico. Mês sem nenhum lançamento é "Sobrou R$ 0", não "Empatou".
 */
export function QuadroDoMes({
  titulo,
  resumo,
  href,
  rotulos,
  money,
  parcial = false,
  aoLadoDoTitulo,
}: {
  /** Casal simples: as duas bolinhas ao lado do título ("o mês soma os dois"). */
  aoLadoDoTitulo?: ReactNode;
  titulo: string;
  resumo: Resumo;
  href: string;
  rotulos: { entrou: string; gastou: string };
  money: (v: number) => string;
  /** Período que não fecha meses inteiros (Últimos 7 dias, alguns dias): "Saldo do período", sem cor de sobra. */
  parcial?: boolean;
}) {
  const s = lerSobrou(sobrouDoResumo(resumo), mesSemLancamento(resumo));
  const faltou = s.situacao === "faltou";
  const ultimo = parcial
    ? { rotulo: "Saldo do período", texto: `${faltou ? "− " : "+ "}${money(s.valor)}`, cor: "var(--color-ink-muted)", fundo: "", corDoValor: "var(--color-ink)" }
    : {
        rotulo: s.rotulo,
        texto: money(s.valor),
        cor: faltou ? "var(--color-dinheiro-faltou)" : "var(--color-dinheiro-sobrou)",
        fundo: faltou ? "bg-[color-mix(in_srgb,var(--color-dinheiro-faltou)_12%,var(--color-surface))]" : "bg-[color-mix(in_srgb,var(--color-dinheiro-sobrou)_12%,var(--color-surface))]",
        corDoValor: faltou ? "var(--color-ink)" : "var(--quadro-cor-sobrou, var(--color-ink))",
      };
  const quadro = [
    { rotulo: rotulos.entrou, texto: money(resumo.totalIncome), cor: "var(--color-dinheiro-entrou)", fundo: "", corDoValor: "var(--quadro-cor-entrou, var(--color-ink))" },
    { rotulo: rotulos.gastou, texto: money(resumo.totalExpense), cor: "var(--color-dinheiro-gastou)", fundo: "", corDoValor: "var(--color-ink)" },
    { rotulo: "Guardou", texto: money(guardadoDoMes(resumo)), cor: "var(--color-dinheiro-guardou)", fundo: "", corDoValor: "var(--quadro-cor-guardou, var(--color-ink))" },
    ultimo,
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-medium text-ink">
          {titulo}
          {aoLadoDoTitulo}
        </h2>
        <Explica>Sobrou é o que entrou menos o que você gastou e o que guardou. Uma conta só, a mesma do gráfico.</Explica>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {quadro.map((q) => (
          <Link key={q.rotulo} href={href} className={`flex min-w-0 flex-col gap-2 rounded-3xl border border-border p-4 ${q.fundo || "bg-surface"}`}>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ background: q.cor }} aria-hidden />
              {q.rotulo}
            </span>
            <span style={{ color: q.corDoValor }} className="text-ink">
              <ValorDestaque texto={q.texto} className="text-[1.5rem] font-light leading-none tracking-[-0.02em] tabular-nums" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
