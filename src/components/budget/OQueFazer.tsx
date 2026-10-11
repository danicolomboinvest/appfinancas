"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronDown, PencilLine, Wallet } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { cobrirCategoriaAction } from "@/app/(app)/orcamento/actions";
import { dispensarAvisoAction } from "@/app/(app)/mensal/foco/actions";
import { planoDeCobrir, porDiaComOLivre, quantoPassou, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";

/**
 * "Passou do plano: o que fazer?" (rodadas 18, 38 e 53). Uma folha curta, na ordem combinada:
 * 1. Ver o que pesou (só leitura); 2. Foi pontual (o plano não muda, o aviso some no mês);
 * 3. Cobrir com outra categoria, pela prioridade (desejo, dia a dia, essencial nunca), com
 * Desfazer; ou usar o livre do mês; 4. Rever o plano, só depois de 3 meses seguidos acima.
 * Nada aqui aumenta o plano sozinho.
 */
export function OQueFazer({
  categoria,
  categorias,
  essenciais = [],
  livre,
  diasRestantes,
  oQuePesou,
  revisao,
  onFeito,
}: {
  categoria: CategoriaParaRemanejo;
  categorias: CategoriaParaRemanejo[];
  essenciais?: string[];
  /** O livre do mês (plano − gastou). Null quando não há orçamento. */
  livre: number | null;
  diasRestantes: number;
  /** A lista dos lançamentos da categoria (logo, nome, valor), já montada por quem chama. */
  oQuePesou?: ReactNode;
  revisao?: { mediana: number } | null;
  onFeito?: () => void;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [pendente, iniciar] = useTransition();
  const [vendo, setVendo] = useState(false);
  const comEssencial = categorias.map((c) => ({ ...c, essencial: c.essencial || essenciais.includes(c.key) }));
  const plano = planoDeCobrir(categoria, comEssencial);
  const valor = quantoPassou(categoria);
  const porDia = livre !== null ? porDiaComOLivre(livre, valor, diasRestantes) : null;

  function feito(mensagem: string, desfazer?: () => Promise<unknown>) {
    showToast(mensagem, desfazer ? { label: "Desfazer", onClick: () => iniciar(async () => { await desfazer(); router.refresh(); }) } : undefined);
    onFeito?.();
    router.refresh();
  }

  function tirar() {
    iniciar(async () => {
      for (const o of plano.origens) {
        const r = await cobrirCategoriaAction({ de: o.key, para: categoria.key, valor: o.valor });
        if (r.error) return showError(r.error);
      }
      const nomes = plano.origens.map((o) => o.label).join(" e ");
      feito(`${categoria.label} coberta com ${nomes}.`, async () => {
        for (const o of plano.origens) await cobrirCategoriaAction({ de: categoria.key, para: o.key, valor: o.valor });
      });
    });
  }

  function dispensar(mensagem: string) {
    iniciar(async () => {
      try {
        await dispensarAvisoAction(`estouro-${categoria.key}`, "mes");
        feito(mensagem);
      } catch {
        showError("Não consegui salvar. Tente de novo.");
      }
    });
  }

  const rotuloTirar =
    plano.origens.length === 1
      ? `Tirar de ${plano.origens[0].label} · sobra ${m(plano.origens[0].sobraDepois)}`
      : plano.origens.map((o) => `${m(o.valor)} de ${o.label}`).join(" + ");
  const botaoTirar = plano.origens.length > 0 && (
    <Opcao key="tirar" icone={ArrowLeftRight} destaque={plano.principal === "tirar"} disabled={pendente} titulo={rotuloTirar} sub="Só neste mês. O total do plano não muda." etiqueta={plano.nivel === 2 ? "é do dia a dia" : undefined} onClick={tirar} />
  );
  const botaoLivre = (
    <Opcao
      key="livre"
      icone={Wallet}
      destaque={plano.principal === "livre"}
      disabled={pendente}
      titulo="Usar o livre do mês"
      sub={porDia !== null ? `Fica ${m(porDia)} por dia até o fim do mês.` : "O que passou sai do que ainda está livre."}
      onClick={() => dispensar(`${categoria.label}: coberta pelo livre do mês.`)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-caption text-ink-muted">Passou do plano</p>
        <p className="text-[1.75rem] font-light tabular-nums text-danger">{m(valor)}</p>
        <p className="text-sm tabular-nums text-ink-muted">
          {m(categoria.gasto)} de {m(categoria.planejado)}
        </p>
      </div>

      {oQuePesou && (
        <div className="rounded-2xl border border-border">
          <button type="button" onClick={() => setVendo((v) => !v)} aria-expanded={vendo} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-medium text-ink">
            Ver o que pesou
            <ChevronDown size={18} className={`text-ink-faint transition-transform ${vendo ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {vendo && <div className="border-t border-border px-3 pb-3 pt-2">{oQuePesou}</div>}
        </div>
      )}

      <Opcao icone={Check} disabled={pendente} titulo="Foi pontual" sub="O plano não muda. O aviso some até o mês que vem." onClick={() => dispensar(`${categoria.label}: marcado como pontual.`)} />

      {plano.principal === "tirar" ? [botaoTirar, botaoLivre] : [botaoLivre, botaoTirar]}
      {plano.origens.length === 0 && (
        <Opcao icone={Check} disabled={pendente} titulo="Deixar assim por agora" sub="Nada muda. Você volta nisso quando quiser." onClick={() => dispensar("Combinado. Fica assim por agora.")} />
      )}

      {revisao && (
        <Link href="/orcamento" className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 hover:bg-surface-hover">
          <PencilLine size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <span>
            <span className="block text-[15px] font-medium text-ink">Rever o plano de {categoria.label}</span>
            <span className="block text-caption text-ink-muted">Passou nos últimos 3 meses. Sugestão: {m(revisao.mediana)}. Nada muda sem você confirmar.</span>
          </span>
        </Link>
      )}
    </div>
  );
}

function Opcao({
  icone: Icone,
  titulo,
  sub,
  etiqueta,
  destaque,
  disabled,
  onClick,
}: {
  icone: typeof Check;
  titulo: string;
  sub: string;
  etiqueta?: string;
  destaque?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition-opacity disabled:opacity-60 ${destaque ? "bg-ink text-canvas" : "border border-border text-ink hover:bg-surface-hover"}`}
    >
      <Icone size={20} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{titulo}</span>
        <span className={`block text-caption ${destaque ? "opacity-80" : "text-ink-muted"}`}>{sub}</span>
        {etiqueta && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${destaque ? "bg-canvas/15" : "bg-surface-2 text-ink-muted"}`}>{etiqueta}</span>}
      </span>
    </button>
  );
}
