"use client";

import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

import { useState } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { formatMoney } from "@/lib/money";
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
  const { voz } = useProfileTheme();
  const money = useMoney();
  const currency = useCurrency();
  const { showToast, showError } = useToast();
  const [marked, setMarked] = useState(done);
  const [openAmount, setOpenAmount] = useState(false);
  // Em centavos, com a máscara de moeda do resto do app. O <input type="number"> cru lia
  // "1.200" (mil e duzentos, como o próprio placeholder escreve) como 1,2 no Chrome do
  // computador: salvava um aporte de R$ 1,20. Na máscara, cada dígito empurra os centavos,
  // então ponto e vírgula digitados não mudam o valor, e ela vê "R$ 1.200,00" antes de salvar.
  const [cents, setCents] = useState<number | null>(null);
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
      showError(result.error);
      return;
    }
    setMarked(true);
    setOpenAmount(false);
    showToast(voz.titulos.metaAporteToast(monthLabel));
  }

  if (marked) {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
        <Check size={12} strokeWidth={3} />
        {voz.titulos.metaAporteFeito(monthLabel)}
      </span>
    );
  }

  if (openAmount) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          aria-label={voz.titulos.metaOutroValor}
          value={cents === null ? "" : formatMoney(cents / 100, currency)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setCents(digits === "" ? null : Number(digits));
          }}
          placeholder={money(suggestedAmount, { round: true })}
          className="w-32 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={pending || !cents}
          onClick={() => cents && send("partial", cents / 100)}
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
        {voz.titulos.metaMarcar(monthLabel)}
      </button>
      <button type="button" onClick={() => setOpenAmount(true)} className="text-caption text-ink-muted hover:text-ink">
        {voz.titulos.metaOutroValor}
      </button>
    </div>
  );
}
