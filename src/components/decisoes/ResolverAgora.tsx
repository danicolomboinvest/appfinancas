"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { cobrirCategoriaAction } from "@/app/(app)/orcamento/actions";
import { dispensarAvisoAction } from "@/app/(app)/mensal/foco/actions";
import { desfazerDispensaAction } from "@/app/(app)/decidir/actions";
import { planoDeCobrir, porDiaComOLivre, quantoPassou, tempoDoMes, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";
import "./decidir.css";

type Opcao = "cobrir" | "livre" | "deixar";

/**
 * "Resolver agora" (rodada 38 A): a categoria que passou do plano se resolve numa folha, ali
 * mesmo, sem sair do Decidir. Antes o botão era "Resolver no Foco" e caía no Resumo.
 *
 * 1. Cobrir com o que sobra em outra categoria, pela prioridade (desejo primeiro, dia a dia só se
 *    precisar, essencial nunca), somando exatamente o que passou. O total do plano não muda.
 * 2. Usar o livre do mês (mostra quanto fica por dia).
 * 3. Deixar assim este mês (registra a escolha; o aviso some até o mês que vem).
 * Ao confirmar: toast curto com Desfazer, e o resto do app (Resumo, Orçamento, a pilha) se atualiza.
 */
export function ResolverAgora({
  rotulo,
  categoria,
  categorias,
  essenciais,
  livre,
  diasRestantes,
  proximoMes,
  className,
}: {
  rotulo: string;
  categoria: string;
  categorias: CategoriaParaRemanejo[];
  essenciais: string[];
  livre: number | null;
  diasRestantes: number;
  /** "novembro": até quando o aviso some no "Deixar assim". */
  proximoMes: string;
  className?: string;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast } = useToast();
  const erro = useErroNoBotao();
  const [aberta, setAberta] = useState(false);
  const [pendente, iniciar] = useTransition();
  const comEssencial = categorias.map((c) => ({ ...c, essencial: c.essencial || essenciais.includes(c.key) }));
  const passou = comEssencial.find((c) => c.key === categoria);
  const plano = passou ? planoDeCobrir(passou, comEssencial, tempoDoMes(diasRestantes)) : null;
  const [opcao, setOpcao] = useState<Opcao>(plano?.principal === "tirar" ? "cobrir" : "livre");
  if (!passou || !plano) return null;
  const valor = quantoPassou(passou);
  const idDoAviso = `estouro-${categoria}`;

  const resolver = () => {
    erro.limpar();
    iniciar(async () => {
      try {
        let desfazer: () => Promise<unknown>;
        if (opcao === "cobrir") {
          for (const o of plano.origens) {
            const r = await cobrirCategoriaAction({ de: o.key, para: categoria, valor: o.valor });
            if (r.error) throw new Error(r.error);
          }
          // Cobriu: o aviso some também (e só volta se piorar bem, ver lib/avisos/regra.ts).
          await dispensarAvisoAction(idDoAviso, "mes", valor, "cobrir");
          desfazer = async () => {
            for (const o of plano.origens) await cobrirCategoriaAction({ de: categoria, para: o.key, valor: o.valor });
            await desfazerDispensaAction(idDoAviso, "mes");
          };
        } else {
          await dispensarAvisoAction(idDoAviso, "mes", valor, "livre");
          desfazer = () => desfazerDispensaAction(idDoAviso, "mes");
        }
        setAberta(false);
        // A pergunta sai da tela: pílula curta, com Desfazer.
        showToast(`${passou.label} resolvida`, { label: "Desfazer", onClick: () => iniciar(async () => { await desfazer(); router.refresh(); }) });
        router.refresh();
      } catch {
        erro.falhou("Não salvou");
      }
    });
  };

  const cobrir = plano.origens.length > 0 && (
    <Item key="cobrir" sel={opcao === "cobrir"} onClick={() => setOpcao("cobrir")} selo={plano.nivel === 1 ? "sugerida" : undefined}>
      <b className="block text-[15px] font-medium text-ink">
        Cobrir com o que sobra em {plano.origens.map((o) => o.label).join(" e ")}
        {plano.nivel === 2 && <em className="dc-tag">é do dia a dia</em>}
      </b>
      <small className="block text-caption text-ink-muted">
        {plano.origens.map((o) => `${o.label} ${m(o.valor)}`).join(" + ")} = <span className="whitespace-nowrap">{m(valor)}</span>. O total do plano não muda.
      </small>
    </Item>
  );
  const usarLivre = (
    <Item key="livre" sel={opcao === "livre"} onClick={() => setOpcao("livre")}>
      <b className="block text-[15px] font-medium text-ink">Usar o livre do mês</b>
      <small className="block text-caption text-ink-muted">
        {livre !== null ? `Fica ${m(porDiaComOLivre(livre, valor, diasRestantes))} por dia até o fim do mês.` : "O que passou sai do que ainda está livre."}
      </small>
    </Item>
  );

  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className={className}>
        {rotulo}
      </button>
      <Modal open={aberta} onClose={() => setAberta(false)} title="Resolver agora">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-semibold text-ink">
              {passou.label} passou {m(valor)} do plano
            </p>
            <p className="text-caption tabular-nums text-ink-muted">
              plano {m(passou.planejado)} · gastou {m(passou.gasto)}
            </p>
          </div>
          <div role="radiogroup" aria-label="Como resolver" className="flex flex-col gap-2">
            {plano.principal === "tirar" ? [cobrir, usarLivre] : [usarLivre, cobrir]}
            <Item sel={opcao === "deixar"} onClick={() => setOpcao("deixar")}>
              <b className="block text-[15px] font-medium text-ink">Deixar assim este mês</b>
              <small className="block text-caption text-ink-muted">O plano não muda. O aviso some até {proximoMes}.</small>
            </Item>
          </div>
          <div>
            <button type="button" disabled={pendente} onClick={resolver} className={`min-h-12 w-full rounded-full bg-ink px-5 text-[15px] font-semibold text-canvas disabled:opacity-60 ${erro.classe}`}>
              {erro.erro ? TENTAR_DE_NOVO : "Resolver"}
            </button>
            <ErroNoBotao erro={erro.erro} />
          </div>
          <Link href="/orcamento" className="self-center py-2 text-sm text-ink-muted underline underline-offset-4">
            Ver o que pesou e outras opções
          </Link>
        </div>
      </Modal>
    </>
  );
}

function Item({ sel, onClick, selo, children }: { sel: boolean; onClick: () => void; selo?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={sel}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${sel ? "bg-surface-2 ring-2 ring-ink" : "border border-border hover:bg-surface-hover"}`}
    >
      <span className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${sel ? "border-ink" : "border-border-strong"}`} aria-hidden>
        {sel && <span className="size-2 rounded-full bg-ink" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {selo && <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{selo}</span>}
    </button>
  );
}
