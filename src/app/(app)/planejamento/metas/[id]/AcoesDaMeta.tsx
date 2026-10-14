"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Minus, Pencil, Plus, Repeat } from "lucide-react";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { guardarNaMetaAction, voltarAoRitmoAction } from "../acoes";
import { AbrirFolhaDaMeta, type MetaParaEditar } from "../FolhaDaMeta";

/** "Voltar ao ritmo" (só na atrasada): guardar o que a conta pede, ou levar o prazo para quando o ritmo chega. */
export function VoltarAoRitmo({ metaId, porMes, novoPrazo }: { metaId: string; porMes: number; novoPrazo: string | null }) {
  const money = useMoney();
  const router = useRouter();
  const erro = useErroNoBotao();
  const [pendente, iniciar] = useTransition();
  // Sem aviso (14/10/2026): o novo valor por mês, ou o novo prazo, aparece no detalhe.
  const rodar = (jeito: "por-mes" | "prazo") => {
    erro.limpar();
    iniciar(async () => {
      const r = await voltarAoRitmoAction(metaId, jeito);
      if (!r.ok) return erro.falhou(r.error);
      router.refresh();
    });
  };
  const chip = "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-[18px] bg-surface-2 px-2.5 py-3 text-ink disabled:opacity-60";
  return (
    <section className="glass flex flex-col gap-2.5 rounded-3xl p-4">
      <b className="text-base font-semibold text-ink">Voltar ao ritmo</b>
      <div className="grid grid-cols-2 gap-2 max-[330px]:grid-cols-1">
        <button type="button" disabled={pendente} onClick={() => rodar("por-mes")} aria-label={`Guardar ${money(porMes, { round: true })} por mês`} className={chip}>
          <Repeat size={16} className="text-ink-muted" aria-hidden />
          <ValorDestaque texto={money(porMes, { round: true })} className="whitespace-nowrap text-lg font-medium tabular-nums" />
          <small className="text-[12.5px] font-medium text-ink-muted">por mês</small>
        </button>
        {novoPrazo && (
          <button type="button" disabled={pendente} onClick={() => rodar("prazo")} aria-label={`Mudar o prazo para ${novoPrazo}`} className={chip}>
            <Calendar size={16} className="text-ink-muted" aria-hidden />
            <b className="text-lg font-medium tabular-nums">{novoPrazo}</b>
            <small className="text-[12.5px] font-medium text-ink-muted">novo prazo</small>
          </button>
        )}
      </div>
      <ErroNoBotao erro={erro.erro} />
    </section>
  );
}

/**
 * A barra de baixo do detalhe: Adicionar, retirar (−) e editar (lápis). A meta que nasceu no
 * assistente de Viagem edita lá (`editarEm` = /viagem?meta=<id>), com a viagem inteira; as
 * outras, na folha da meta.
 */
export function BarraDaMeta({ metaId, meta, editarEm }: { metaId: string; meta: MetaParaEditar; editarEm?: string }) {
  const router = useRouter();
  const erro = useErroNoBotao();
  const [pendente, iniciar] = useTransition();
  const [tipo, setTipo] = useState<"adicionar" | "retirar" | null>(null);
  const [valor, setValor] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const simbolo = currencySymbol(useCurrency());

  useEffect(() => {
    if (tipo) campo.current?.focus({ preventScroll: false });
  }, [tipo]);

  const confirmar = () => {
    if (!tipo || !(valor > 0)) return;
    // Sem aviso (14/10/2026): o total da meta muda na tela.
    erro.limpar();
    iniciar(async () => {
      const r = await guardarNaMetaAction(metaId, valor, tipo);
      if (!r.ok) return erro.falhou(r.error);
      setTipo(null);
      setValor(0);
      router.refresh();
    });
  };

  const redondo = "flex size-[54px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-premium-sm";
  return (
    <>
      {tipo && (
        <section className="glass flex flex-col gap-2 rounded-3xl p-4">
          <b className="text-base font-semibold text-ink">{tipo === "adicionar" ? "Quanto você vai adicionar?" : "Quanto você vai retirar?"}</b>
          <label className="mx-auto flex items-baseline gap-2">
            <span className="text-lg text-ink-muted">{simbolo}</span>
            <CampoDeDinheiro
              ref={campo}
              placeholder="0,00"
              aria-label="Valor"
              valor={valor}
              onValor={(v) => setValor(v ?? 0)}
              onKeyDown={(ev) => ev.key === "Enter" && confirmar()}
              className="w-[9ch] border-b-2 border-accent bg-transparent pb-1 text-center text-[34px] font-light tabular-nums text-ink outline-none"
            />
          </label>
          <button type="button" disabled={pendente || !(valor > 0)} onClick={confirmar} className={`min-h-12 rounded-full bg-ink text-[15px] font-semibold text-canvas disabled:opacity-50 ${erro.classe}`}>
            {pendente ? "Salvando…" : erro.erro ? TENTAR_DE_NOVO : tipo === "adicionar" ? "Adicionar" : "Retirar"}
          </button>
          <ErroNoBotao erro={erro.erro} />
        </section>
      )}
      <div className="sticky bottom-[calc(10px+var(--safe-bottom))] z-10 mt-auto flex items-center gap-2.5 pt-1.5">
        <button type="button" onClick={() => setTipo("adicionar")} className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-semibold text-canvas shadow-[0_14px_28px_-14px_rgba(40,10,20,0.55)]">
          <Plus size={18} aria-hidden />
          Adicionar
        </button>
        <button type="button" aria-label="Retirar" onClick={() => setTipo("retirar")} className={redondo}>
          <Minus size={20} aria-hidden />
        </button>
        {editarEm ? (
          <Link href={editarEm} aria-label="Editar" className={redondo}>
            <Pencil size={18} aria-hidden />
          </Link>
        ) : (
          <AbrirFolhaDaMeta meta={meta} rotulo="Editar" className={redondo}>
            <Pencil size={18} aria-hidden />
          </AbrirFolhaDaMeta>
        )}
      </div>
    </>
  );
}
