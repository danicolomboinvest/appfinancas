import Link from "next/link";
import { ArrowLeftRight, Check, ChevronLeft, CreditCard, PiggyBank, Undo2, type LucideIcon } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { PageHeader } from "@/components/ui/PageHeader";
import type { TipoRevisao } from "@/lib/decisoes/revisao-antigos";
import { conferirLancamentoAction, resolverLancamentoAntigoAction } from "../actions";
import { carregarAConferir, carregarRevisaoAntigos, type ItemAConferir } from "./dados";
import { PARENT_CATEGORIES, categoriaOculta, categoryLabel, type CategoriasDoPerfil } from "@/lib/categories";
import type { AuthContext } from "@/lib/auth/session";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** A pergunta e as respostas possíveis de cada tipo de lançamento antigo. */
const PERGUNTA: Record<TipoRevisao, { texto: string; opcoes: { acao: "guardado" | "tirar" | "estorno" | "resgate" | "manter"; rotulo: string }[] }> = {
  aplicacao: {
    texto: "Parece dinheiro que você guardou, não gasto.",
    opcoes: [
      { acao: "guardado", rotulo: "É aplicação: contar como guardado" },
      { acao: "manter", rotulo: "É gasto mesmo" },
    ],
  },
  fatura: {
    texto: "As compras da fatura já estão aqui. Este pagamento conta tudo de novo.",
    opcoes: [
      { acao: "tirar", rotulo: "Tirar (as compras já estão lá)" },
      { acao: "manter", rotulo: "Manter" },
    ],
  },
  conta_propria_saida: {
    texto: "Parece dinheiro indo para uma conta sua.",
    opcoes: [
      { acao: "guardado", rotulo: "Guardei (aplicação)" },
      { acao: "tirar", rotulo: "Só mudei de conta: tirar" },
      { acao: "manter", rotulo: "Foi gasto" },
    ],
  },
  conta_propria_entrada: {
    texto: "Parece dinheiro vindo de uma conta sua, não renda.",
    opcoes: [
      { acao: "tirar", rotulo: "Só mudei de conta: tirar" },
      { acao: "manter", rotulo: "É renda" },
    ],
  },
  resgate: {
    texto: "Parece dinheiro voltando da aplicação, não renda.",
    opcoes: [
      { acao: "resgate", rotulo: "É resgate: descontar do guardado" },
      { acao: "manter", rotulo: "É renda" },
    ],
  },
  estorno: {
    texto: "Parece estorno: dinheiro de uma compra voltando. Está contando como renda.",
    opcoes: [
      { acao: "estorno", rotulo: "É estorno: descontar do gasto" },
      { acao: "manter", rotulo: "É renda" },
    ],
  },
};

/** O desenho de cada tipo (versão nova, 13/10/2026). */
const ICONE: Record<TipoRevisao, LucideIcon> = {
  aplicacao: PiggyBank,
  fatura: CreditCard,
  conta_propria_saida: ArrowLeftRight,
  conta_propria_entrada: ArrowLeftRight,
  resgate: PiggyBank,
  estorno: Undo2,
};

/**
 * Revisão dos lançamentos antigos: o que entrou antes de a importação separar aplicação, fatura,
 * conta própria e estorno. Um por um, a pessoa decide; nada muda sozinho.
 */
export default async function RevisarAntigosPage() {
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const [itens, aConferir] = await Promise.all([carregarRevisaoAntigos(ctx), carregarAConferir(ctx)]);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link href="/mensal/foco" className="flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Resumo
      </Link>
      <PageHeader title="Revisar lançamentos" />
      {/* Os "A conferir" primeiro, um por vez (o que ficou sem resposta no extrato). */}
      {aConferir.length > 0 ? (
        <UmAConferir item={aConferir[0]} total={aConferir.length} ctx={ctx} valor={money(aConferir[0].valor)} />
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-5 py-8 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={26} strokeWidth={2.4} aria-hidden />
          </span>
          <p className="text-[17px] font-semibold text-ink">Tudo revisado</p>
          <Link href="/mensal/foco" className="botao-principal inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold">
            Voltar ao Resumo
          </Link>
        </div>
      ) : (
        <>
          <p className="-mt-2 text-[15px] text-ink-muted">{itens.length === 1 ? "1 lançamento" : `${itens.length} lançamentos`}. Nada muda sem você.</p>
          {itens.map((it) => {
            const Icone = ICONE[it.tipo];
            return (
              <section key={it.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
                    <Icone size={19} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block break-words text-[15px] font-semibold leading-snug text-ink">{it.descricao}</b>
                    <small className="text-[13px] text-ink-muted">{it.data ? `${it.data.slice(8, 10)}/${it.data.slice(5, 7)}/${it.data.slice(0, 4)}` : `${MESES[it.mes - 1]}/${it.ano}`}</small>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{money(it.valor)}</span>
                </div>
                <p className="rounded-xl bg-surface-2 px-3 py-2 text-[14px] leading-snug text-ink">{PERGUNTA[it.tipo].texto}</p>
                <div className="flex flex-col gap-2">
                  {PERGUNTA[it.tipo].opcoes.map((o, i) => (
                    <form key={o.acao} action={resolverLancamentoAntigoAction.bind(null, it.id, o.acao)}>
                      <button
                        type="submit"
                        className={`min-h-11 w-full rounded-full px-4 py-2 text-[14.5px] font-semibold leading-tight active:scale-[0.98] ${
                          i === 0 ? "botao-principal" : "text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]"
                        }`}
                      >
                        {o.rotulo}
                      </button>
                    </form>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * Um lançamento "A conferir" por vez (leva 1 do primeiro uso, 14/10/2026): "O que foi isso?" e as
 * categorias em um toque. Responder já traz o próximo.
 */
function UmAConferir({ item, total, ctx, valor }: { item: ItemAConferir; total: number; ctx: AuthContext; valor: string }) {
  const categorias: CategoriasDoPerfil = ctx.categorias ?? ctx.profileKind;
  const opcoes: { valor: string; rotulo: string }[] = item.entrada
    ? [
        { valor: "renda", rotulo: "É renda" },
        { valor: "tirar", rotulo: "Só mudei de conta" },
      ]
    : [
        ...PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categorias, pc)).map((pc) => ({ valor: pc as string, rotulo: categoryLabel(categorias, pc) })),
        { valor: "aplicacao", rotulo: "Guardei" },
        { valor: "tirar", rotulo: "Só mudei de conta" },
      ];
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]" data-a-conferir>
      <p className="text-[13px] font-semibold text-ink-muted">{total === 1 ? "Falta 1 para conferir" : `1 de ${total} para conferir`}</p>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <b className="block break-words text-[16px] font-semibold leading-snug text-ink">{item.descricao}</b>
          <small className="text-[13px] text-ink-muted">{item.data ? `${item.data.slice(8, 10)}/${item.data.slice(5, 7)}` : `${MESES[item.mes - 1]}/${item.ano}`}</small>
        </span>
        <span className="shrink-0 text-[16px] font-semibold tabular-nums text-ink">{valor}</span>
      </div>
      <p className="text-[17px] font-semibold text-ink">{item.entrada ? "Isso foi renda?" : "O que foi isso?"}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <form key={o.valor} action={conferirLancamentoAction.bind(null, item.id, o.valor)}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full px-4 text-[14.5px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] active:scale-[0.98]">
              {o.rotulo}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
