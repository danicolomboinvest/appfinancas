"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import { checkinGoalAction } from "./actions";

/**
 * "Marcar aporte de setembro" em um toque — e "Aporte de setembro feito" depois.
 *
 * Substitui o check-in que era uma pergunta com botões ("Você guardou os R$ 681 sugeridos em
 * setembro?" → Sim / Não guardei → quanto?). Três decisões para registrar um aporte que a
 * pessoa já fez é atrito: quem abriu a tela de metas para marcar o aporte já sabe a resposta.
 *
 * Também deixou de aparecer só entre os dias 25 e 7. Aquela janela fazia sentido para uma
 * PERGUNTA (não dá pra cobrar um mês que nem acabou), mas aqui é um botão: o aporte sai da
 * conta no dia 10, e é nesse dia que a pessoa quer marcar.
 *
 * O caminho de "guardei menos" continua existindo, atrás de "outro valor" — só não ocupa mais
 * o lugar principal, porque é o caso menos comum.
 */
export function GoalAporteChip({
  goalId,
  monthKey,
  monthLabel,
  suggestedAmount,
  done,
}: {
  goalId: string;
  monthKey: string;
  monthLabel: string;
  suggestedAmount: number;
  done: boolean;
}) {
  const money = useMoney();
  const { showToast } = useToast();
  const [marked, setMarked] = useState(done);
  const [openAmount, setOpenAmount] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  async function send(decision: "done" | "partial", value?: number) {
    setPending(true);
    const formData = new FormData();
    formData.set("goalId", goalId);
    formData.set("monthKey", monthKey);
    formData.set("decision", decision);
    if (value) formData.set("amount", String(value));
    const result = await checkinGoalAction({}, formData);
    setPending(false);
    if (result.error) {
      showToast(result.error);
      return;
    }
    setMarked(true);
    setOpenAmount(false);
    showToast(`Aporte de ${monthLabel} registrado na meta.`);
  }

  if (marked) {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
        <Check size={12} strokeWidth={3} />
        Aporte de {monthLabel} feito
      </span>
    );
  }

  if (openAmount) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={money(suggestedAmount, { round: true })}
          className="w-28 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={pending || !Number(amount.replace(",", "."))}
          onClick={() => send("partial", Number(amount.replace(",", ".")))}
          className="rounded-full bg-accent px-3 py-1.5 text-caption font-semibold text-on-accent disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setOpenAmount(false)}
          className="text-caption text-ink-muted hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => send("done")}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
      >
        <span className="size-3 rounded-[4px] border-[1.5px] border-border-strong" aria-hidden />
        Marcar aporte de {monthLabel}
      </button>
      <button type="button" onClick={() => setOpenAmount(true)} className="text-caption text-ink-muted hover:text-ink">
        outro valor
      </button>
    </div>
  );
}
