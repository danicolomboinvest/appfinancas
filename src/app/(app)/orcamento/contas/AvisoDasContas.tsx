"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { desfazerContaDoHistoricoAction, fecharAvisoDasContasAction } from "./actions";
import { iconeDaConta } from "./icone-da-conta";

export type ContaNovaDoHistorico = { id: string; nome: string; valor: number | null; aproximado: boolean; dia: number | null };

/**
 * "Achei N contas no seu histórico" (12/10/2026): aparece uma vez, quando o app cadastrou contas
 * sozinho a partir do extrato. Cada uma tem o "Desfazer" (apaga e nunca volta); o X fecha o aviso.
 * Sem tela de confirmação: as contas já estão em Contas.
 */
export function AvisoDasContas({ contas }: { contas: ContaNovaDoHistorico[] }) {
  const money = useMoney();
  const router = useRouter();
  const [lista, setLista] = useState(contas);
  const [fechado, setFechado] = useState(false);
  const [, iniciar] = useTransition();
  if (fechado || lista.length === 0) return null;

  function desfazer(id: string) {
    setLista((l) => l.filter((c) => c.id !== id));
    iniciar(async () => {
      await desfazerContaDoHistoricoAction(id);
      router.refresh();
    });
  }
  function fechar() {
    setFechado(true);
    iniciar(async () => {
      await fecharAvisoDasContasAction();
      router.refresh();
    });
  }

  return (
    <section aria-label="Contas achadas no histórico" className="flex flex-col gap-1 rounded-3xl border border-border bg-surface px-3 pb-1 pt-3">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-[16px] font-medium leading-snug text-ink">
            Achei {lista.length} {lista.length === 1 ? "conta" : "contas"} no seu histórico
          </h2>
          <p className="text-[13px] text-ink-muted">{lista.length === 1 ? "Já está em Contas." : "Já estão em Contas."}</p>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar aviso" className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted active:scale-95">
          <X size={18} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <ul className="divide-y divide-border">
        {lista.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 py-2.5">
            <LogoDoLancamento descricao={c.nome} icon={iconeDaConta(c.nome)} cor="var(--color-ink-muted)" size={36} />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] leading-snug text-ink">{c.nome}</span>
              <span className="block text-[13px] tabular-nums text-ink-muted">
                {c.valor !== null ? `${c.aproximado ? "~" : ""}${money(c.valor, { round: c.aproximado })}` : "varia"}
                {c.dia ? ` · dia ${c.dia}` : ""}
              </span>
            </span>
            <button type="button" onClick={() => desfazer(c.id)} className="min-h-11 shrink-0 px-2 text-[13px] font-medium text-accent-strong">
              Desfazer
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
