import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import type { TipoRevisao } from "@/lib/decisoes/revisao-antigos";
import { resolverLancamentoAntigoAction } from "../actions";
import { carregarRevisaoAntigos } from "./dados";

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
    texto: "Você importa a fatura, então as compras dela já estão lançadas. Esse pagamento conta tudo de novo.",
    opcoes: [
      { acao: "tirar", rotulo: "Tirar (as compras já estão lá)" },
      { acao: "manter", rotulo: "Manter" },
    ],
  },
  conta_propria_saida: {
    texto: "Parece dinheiro indo pra uma conta sua.",
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

/**
 * Revisão dos lançamentos antigos: o que entrou antes de a importação separar aplicação, fatura,
 * conta própria e estorno. Um por um, a pessoa decide; nada muda sozinho.
 */
export default async function RevisarAntigosPage() {
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const itens = await carregarRevisaoAntigos(ctx);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/mensal/foco" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> Foco
      </Link>
      <PageHeader title="Revisar lançamentos antigos" subtitle="Aplicação, pagamento de fatura e estorno que entraram como gasto ou renda. Você decide um por um." />
      {itens.length === 0 ? (
        <p className="text-sm text-ink-muted">Nada pra revisar. Tudo certo por aqui.</p>
      ) : (
        itens.map((it) => (
          <Card key={it.id} className="flex flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-ink">{it.descricao}</p>
              <p className="shrink-0 text-sm tabular-nums text-ink">{money(it.valor)}</p>
            </div>
            <p className="text-caption text-ink-faint">{it.data ? `${it.data.slice(8, 10)}/${it.data.slice(5, 7)}/${it.data.slice(0, 4)}` : `${MESES[it.mes - 1]}/${it.ano}`}</p>
            <p className="text-sm text-ink-muted">{PERGUNTA[it.tipo].texto}</p>
            <div className="flex flex-wrap gap-2">
              {PERGUNTA[it.tipo].opcoes.map((o, i) => (
                <form key={o.acao} action={resolverLancamentoAntigoAction.bind(null, it.id, o.acao)}>
                  <button
                    type="submit"
                    className={i === 0 ? "rounded-xl bg-pill px-3 py-1.5 text-caption font-semibold text-on-pill" : "rounded-xl border border-border px-3 py-1.5 text-caption font-semibold text-ink-muted"}
                  >
                    {o.rotulo}
                  </button>
                </form>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
