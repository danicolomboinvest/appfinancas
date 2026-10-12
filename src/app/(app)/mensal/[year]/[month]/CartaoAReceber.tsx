"use client";

import { useState, useTransition } from "react";
import { Explica } from "@/components/ui/Explica";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { desfazerRecebidoAction, marcarRecebidoAction } from "./transacao-actions";

/**
 * "Marina te deve R$ 43,65 · A receber" com o botão Recebi, em cima da lista de Transações
 * (protótipo). Some quando ninguém deve nada.
 */
export function CartaoAReceber({ aReceber }: { aReceber: { pessoa: string; valor: number }[] }) {
  const money = useMoney();
  const { showToast, showError } = useToast();
  const [pendente, start] = useTransition();
  const [recebeu, setRecebeu] = useState<string | null>(null);
  const primeira = aReceber[0];
  if (!primeira) return null;
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-accent-soft py-3.5 pl-4 pr-3.5" data-a-receber>
      <div className="min-w-0 flex-1">
        <b className="block font-medium text-ink">
          {primeira.pessoa} te deve {money(primeira.valor)}
        </b>
        <span className="text-[13px] text-ink-muted">{aReceber.length > 1 ? `+ ${aReceber.length - 1} ${aReceber.length > 2 ? "pessoas" : "pessoa"} · A receber` : "A receber"}</span>
      </div>
      <Explica>Quando alguém te deve uma parte, ela fica em A receber até o Pix chegar. O Pix abate o gasto e não conta como renda.</Explica>
      <button
        type="button"
        disabled={pendente || recebeu === primeira.pessoa}
        onClick={() =>
          start(async () => {
            const r = await marcarRecebidoAction(primeira.pessoa).catch(() => null);
            if (!r?.ok) return showError("Não deu para marcar. Tente de novo.");
            setRecebeu(primeira.pessoa);
            showToast(`${primeira.pessoa} acertou`, {
              label: "Desfazer",
              onClick: () => start(async () => void (await desfazerRecebidoAction(r.desfazer).catch(() => null))),
            });
          })
        }
        className="min-h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-surface disabled:opacity-40"
      >
        Recebi
      </button>
    </div>
  );
}
