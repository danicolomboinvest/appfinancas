"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { guardeiNaReservaAction } from "./actions";

/**
 * "Guardei R$ 300 este mês" na reserva, em um toque — o mesmo gesto que as metas já tinham.
 *
 * Antes, fazer a reserva crescer era abrir o formulário e reescrever o "Já tenho guardado"
 * somando de cabeça. Aqui o toque lança o guardado no mês e soma na reserva; o valor que vale
 * é o combinado lido no servidor, o da tela é só o rótulo.
 *
 * "Outro valor" fica atrás de um link, como nas metas: é o caso menos comum. O campo usa a
 * máscara de moeda do app (cada dígito empurra os centavos), pelo mesmo motivo do
 * GoalAporteChip: <input type="number"> lia "1.200" como 1,2 no Chrome do computador.
 */
export function GuardeiNaReservaButton({
  valorCombinado,
  mesLabel,
  feito,
}: {
  valorCombinado: number;
  /** "setembro": o mês que o botão marca. */
  mesLabel: string;
  /** O mês já foi marcado (outra aba, ou antes de recarregar). */
  feito: boolean;
}) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const currency = useCurrency();
  const { showToast, showError } = useToast();
  const [marcado, setMarcado] = useState(feito);
  const [outroValor, setOutroValor] = useState(false);
  const [centavos, setCentavos] = useState<number | null>(null);
  const [pendente, setPendente] = useState(false);

  async function enviar(valor?: number) {
    setPendente(true);
    const r = await guardeiNaReservaAction(valor ? { valor } : {});
    setPendente(false);
    if (r.error) {
      showError(r.error);
      return;
    }
    setMarcado(true);
    setOutroValor(false);
    // "Já feito" (outra aba marcou antes): não repete o toast de que somou, só mostra o estado.
    if (!r.jaFeito && r.valor) showToast(t.reservaGuardeiToast(money(r.valor, { round: true })));
  }

  if (marcado) {
    return (
      <p className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-success-soft px-4 text-sm font-semibold text-success">
        <Check size={16} strokeWidth={2.5} aria-hidden />
        {t.reservaGuardeiFeito(mesLabel)}
      </p>
    );
  }

  if (outroValor) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          aria-label={t.metaOutroValor}
          value={centavos === null ? "" : formatMoney(centavos / 100, currency)}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, "");
            setCentavos(digitos === "" ? null : Number(digitos));
          }}
          placeholder={money(valorCombinado, { round: true })}
          // 16px: abaixo disso o Safari do iPhone dá zoom na tela ao tocar no campo.
          className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-base tabular-nums text-ink outline-none focus:border-accent sm:w-44"
        />
        <div className="flex gap-2">
          <Button type="button" className="flex-1 sm:flex-none" disabled={pendente || !centavos} onClick={() => centavos && enviar(centavos / 100)}>
            {pendente ? t.formSalvando : t.formSalvar}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOutroValor(false)}>
            {t.formCancelar}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <Button type="button" className="w-full sm:w-fit" disabled={pendente} onClick={() => enviar()}>
          <Check size={16} strokeWidth={2.5} aria-hidden />
          {pendente ? t.formSalvando : t.reservaGuardeiBotao(money(valorCombinado, { round: true }))}
        </Button>
        <button
          type="button"
          onClick={() => setOutroValor(true)}
          className="min-h-11 self-center px-2 text-sm text-ink-muted hover:text-ink sm:self-auto"
        >
          {t.metaOutroValor}
        </button>
      </div>
    </div>
  );
}
