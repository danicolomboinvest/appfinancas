"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, ChevronDown, ChevronRight, CircleCheck, List, TriangleAlert, type LucideIcon } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { ErroNoBotao, TENTAR_DE_NOVO } from "@/components/ui/ErroNoBotao";
import { vibrar } from "@/lib/celebrar";
import { brilharQuandoAparecer } from "@/lib/ui/brilho";
import { marcarSelo, seloDaCategoria } from "@/lib/ui/selos";
import { cobrirCategoriaAction } from "@/app/(app)/orcamento/actions";
import { dispensarAvisoAction } from "@/app/(app)/mensal/foco/actions";
import { fontesParaCobrir, planoDeCobrir, quantoPassou, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";

/**
 * A folha "O que fazer?" (protótipo aprovado, #passou): o ícone, "Saúde passou R$ 67 do plano /
 * R$ 417 de R$ 350 em outubro" e quatro cartões: 1. Ver o que pesou; 2. Foi pontual (o plano não
 * muda, o aviso some no mês); 3. Cobrir com outra categoria (abre as opções, por prioridade:
 * desejo, dia a dia, essencial nunca; com Desfazer); 4. o aviso "Passou 3 meses seguidos", que leva
 * a rever o plano. Nada aqui aumenta o plano sozinho.
 */
export function OQueFazer({
  categoria,
  categorias,
  essenciais = [],
  oQuePesou,
  revisao,
  onFeito,
  mes,
  icone,
  quantos,
  hrefDoPlano,
}: {
  /** "outubro": "R$ 417 de R$ 350 em outubro". */
  mes?: string;
  /** O ícone da categoria, no topo. */
  icone?: ReactNode;
  /** Quantos lançamentos pesaram ("3 lançamentos em Saúde"). */
  quantos?: number;
  /** Para onde vai o "Passou 3 meses seguidos" (o plano). */
  hrefDoPlano?: string;
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
  const { showToast } = useToast();
  const [pendente, iniciar] = useTransition();
  // Erro no lugar (14/10/2026): embaixo da opção que falhou, até a próxima tentativa.
  const [erro, setErro] = useState<{ onde: "pontual" | "cobrir"; texto: string } | null>(null);
  const [vendo, setVendo] = useState(false);
  const comEssencial = categorias.map((c) => ({ ...c, essencial: c.essencial || essenciais.includes(c.key) }));
  const plano = planoDeCobrir(categoria, comEssencial);
  const valor = quantoPassou(categoria);

  /**
   * "Foi pontual" não avisa nada (14/10/2026): a categoria ganha o selinho "pontual" e acende.
   * Cobrir ganha a pílula curta, porque tem Desfazer.
   */
  function feito(mensagem: string | null, desfazer?: () => Promise<unknown>) {
    if (mensagem) showToast(mensagem, desfazer ? { label: "Desfazer", onClick: () => iniciar(async () => { await desfazer(); router.refresh(); }) } : undefined);
    onFeito?.();
    router.refresh();
    brilharQuandoAparecer(`cat-${categoria.key}`);
  }

  function dispensar() {
    setErro(null);
    iniciar(async () => {
      try {
        await dispensarAvisoAction(`estouro-${categoria.key}`, "mes");
        marcarSelo(seloDaCategoria(categoria.key, mes), "pontual");
        feito(null);
      } catch {
        vibrar("erro");
        setErro({ onde: "pontual", texto: "Não salvou" });
      }
    });
  }

  const fontes = fontesParaCobrir(categoria, comEssencial);
  const [cobrindo, setCobrindo] = useState(false);
  const [de, setDe] = useState<string | null>(fontes[0]?.key ?? null);
  const escolhida = fontes.find((f) => f.key === de) ?? null;

  function cobrirCom(origens: { key: string; label: string; valor: number }[]) {
    setErro(null);
    iniciar(async () => {
      for (const o of origens) {
        const r = await cobrirCategoriaAction({ de: o.key, para: categoria.key, valor: o.valor });
        if (r.error) {
          vibrar("erro");
          return setErro({ onde: "cobrir", texto: r.error });
        }
      }
      feito(`${categoria.label} coberta`, async () => {
        for (const o of origens) await cobrirCategoriaAction({ de: categoria.key, para: o.key, valor: o.valor });
      });
    });
  }
  const temCobrir = fontes.length > 0 || plano.origens.length > 0;
  const planejadoDe = (key: string) => comEssencial.find((c) => c.key === key)?.planejado ?? 0;

  return (
    <div className="flex flex-col gap-3" data-o-que-fazer>
      <div className="flex flex-col items-center gap-1 pb-1 text-center">
        {icone && <span className="mb-1">{icone}</span>}
        <b className="text-[17px] font-medium text-ink">
          {categoria.label} passou {m(valor)} do plano
        </b>
        <span className="text-sm tabular-nums text-ink-muted">
          {m(categoria.gasto)} de {m(categoria.planejado)}
          {mes ? ` em ${mes}` : ""}
        </span>
      </div>

      {oQuePesou && (
        <>
          <Opcao icone={List} titulo="Ver o que pesou" sub={quantos ? `${quantos} ${quantos > 1 ? "lançamentos" : "lançamento"} em ${categoria.label}` : `Os gastos de ${categoria.label}`} aberta={vendo} onClick={() => setVendo((v) => !v)} />
          {vendo && <div className="rounded-2xl bg-surface px-3 pb-2 pt-1 shadow-[inset_0_0_0_1px_var(--color-border)]">{oQuePesou}</div>}
        </>
      )}

      <Opcao icone={CircleCheck} seta disabled={pendente} titulo="Foi pontual" sub="Uma consulta, um exame. O plano não muda." onClick={dispensar} />
      {erro?.onde === "pontual" && <ErroNoBotao erro={erro.texto} />}

      {temCobrir && (
        <Opcao icone={ArrowLeftRight} titulo="Cobrir com outra categoria" sub="Só deste mês. O total do plano não muda." aberta={cobrindo} onClick={() => setCobrindo((v) => !v)} />
      )}
      {cobrindo && fontes.length > 0 && escolhida && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]" data-cobrir>
          <h3 className="text-[15px] font-medium text-ink">Tirar {m(valor)} de</h3>
          <div className="flex flex-wrap gap-2">
            {fontes.map((f) => (
              <button key={f.key} type="button" aria-pressed={f.key === de} onClick={() => setDe(f.key)} className="min-h-10 rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-surface">
                {f.label} · {m(f.folga)} livres{f.nivel === 2 ? " · dia a dia" : ""}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-sm tabular-nums text-ink-muted">
            <span>
              {categoria.label} <s>{m(categoria.planejado)}</s> → <b className="font-medium text-ink">{m(categoria.planejado + valor)}</b>
            </span>
            <span>
              {escolhida.label} <s>{m(planejadoDe(escolhida.key))}</s> → <b className="font-medium text-ink">{m(planejadoDe(escolhida.key) - valor)}</b>
            </span>
          </div>
          <button type="button" disabled={pendente} onClick={() => cobrirCom([escolhida])} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-50">
            {erro?.onde === "cobrir" ? TENTAR_DE_NOVO : `Cobrir ${m(valor)} com ${escolhida.label}`}
          </button>
          {erro?.onde === "cobrir" && <ErroNoBotao erro={erro.texto} />}
        </div>
      )}
      {cobrindo && fontes.length === 0 && plano.origens.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]" data-cobrir>
          <p className="text-sm text-ink-muted">Nenhuma categoria cobre sozinha. Juntando duas:</p>
          <button type="button" disabled={pendente} onClick={() => cobrirCom(plano.origens)} className="min-h-12 rounded-full bg-ink px-4 text-[15px] font-medium text-surface disabled:opacity-50">
            {erro?.onde === "cobrir" ? TENTAR_DE_NOVO : plano.origens.map((o) => `${m(o.valor)} de ${o.label}`).join(" + ")}
          </button>
          {erro?.onde === "cobrir" && <ErroNoBotao erro={erro.texto} />}
        </div>
      )}

      {revisao && (
        <Link href={hrefDoPlano ?? "/orcamento"} className="flex items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3.5" data-rever-plano>
          <TriangleAlert size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Passou 3 meses seguidos</span>
            <span className="block text-caption text-ink-muted">
              Quer rever o plano de {categoria.label}? Sugestão: {m(revisao.mediana)}. Nada muda sem você confirmar.
            </span>
          </span>
          <ChevronRight size={16} className="mt-1 shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Opcao({
  icone: Icone,
  titulo,
  sub,
  aberta,
  seta,
  disabled,
  onClick,
}: {
  icone: LucideIcon;
  titulo: string;
  sub: string;
  /** Abre um pedaço logo abaixo (Ver o que pesou, Cobrir). */
  aberta?: boolean;
  seta?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-expanded={aberta}
      className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left text-ink shadow-[inset_0_0_0_1px_var(--color-border)] transition-opacity disabled:opacity-60 aria-expanded:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <Icone size={19} strokeWidth={1.6} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{titulo}</span>
        <span className="block text-caption text-ink-muted">{sub}</span>
      </span>
      {aberta !== undefined ? <ChevronDown size={16} className={`shrink-0 text-ink-muted transition-transform ${aberta ? "rotate-180" : ""}`} aria-hidden /> : seta ? <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden /> : null}
    </button>
  );
}
