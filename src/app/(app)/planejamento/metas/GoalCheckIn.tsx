"use client";

import { useActionState, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast-context";
import { checkinGoalAction, type GoalCheckinState } from "./actions";

const initialState: GoalCheckinState = {};

/** Input de valor com "R$" fixo dentro, mesmo padrão usado no planejador de viagem. */
function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">R$</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step="0.01"
        {...props}
        className="w-full rounded-lg border border-border-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </span>
  );
}

type Step = "ask" | "ask-partial-amount" | "done";

/**
 * Check-in mensal: "você guardou o aporte sugerido este mês?" — sem essa confirmação, o status
 * da meta é só matemática projetada, ninguém nunca CONFIRMA que o dinheiro saiu do bolso de
 * verdade. "Sim" e "coloquei um valor" viram um lançamento real vinculado à meta; "não guardei
 * nada" não cria nada — a meta não avança, o ritmo reflete isso sem maquiagem.
 */
export function GoalCheckIn({
  goalId,
  monthLabel,
  monthKey,
  suggestedAmount,
}: {
  goalId: string;
  monthLabel: string;
  monthKey: string;
  suggestedAmount: number;
}) {
  const [step, setStep] = useState<Step>("ask");
  const [amount, setAmount] = useState("");
  const [state, formAction, isPending] = useActionState(checkinGoalAction, initialState);
  const { showToast } = useToast();

  function submit(decision: "done" | "partial" | "none", extra?: string) {
    const formData = new FormData();
    formData.set("goalId", goalId);
    formData.set("monthKey", monthKey);
    formData.set("decision", decision);
    if (extra) formData.set("amount", extra);
    // startTransition implícito do useActionState via formAction(FormData) direto.
    formAction(formData);
  }

  function handleDone() {
    submit("done");
    setStep("done");
    showToast("Aporte confirmado! Sua meta continua de pé.");
  }

  function handleNone() {
    submit("none");
    setStep("done");
    showToast("Sem problema — o ritmo da meta já reflete isso.");
  }

  function handlePartialConfirm() {
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return;
    submit("partial", String(value));
    setStep("done");
    showToast("Valor registrado na sua meta.");
  }

  if (step === "done" || state.ok) return null;

  return (
    <div className="rounded-xl border border-accent-strong/30 bg-accent-soft p-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
        <div className="min-w-0 flex-1">
          {step === "ask" && (
            <>
              <p className="text-sm text-ink">
                Você guardou os{" "}
                <strong className="tabular-nums">
                  {suggestedAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>{" "}
                sugeridos em {monthLabel}?
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={isPending} onClick={handleDone}>
                  Sim, guardei
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => setStep("ask-partial-amount")}
                >
                  Não guardei
                </Button>
              </div>
            </>
          )}

          {step === "ask-partial-amount" && (
            <>
              <p className="text-sm text-ink">Sem problema. Colocou algum valor nessa meta, mesmo que menor?</p>
              <div className="mt-2.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-32">
                    <MoneyInput
                      aria-label="Valor guardado"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <Button type="button" size="sm" disabled={isPending || !amount} onClick={handlePartialConfirm}>
                    Registrar
                  </Button>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleNone}
                  className="w-fit text-xs text-ink-muted underline decoration-dotted hover:text-ink"
                >
                  Não, não guardei nada este mês
                </button>
              </div>
            </>
          )}

          {state.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
        </div>
      </div>
    </div>
  );
}
