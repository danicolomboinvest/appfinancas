"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import { resgatarDoAtivoAction } from "./contribution-actions";

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Resgatei" dentro do "Mexer" de um investimento (01/10/2026). Antes, mexer só trocava quanto
 * vale e quantas cotas, e o resgate não ficava registrado em lugar nenhum. Aqui ela diz quanto
 * tirou e quando: entra no mês como resgate e o investimento desconta, mantendo a rentabilidade.
 */
export function ResgatarDoAtivo({ assetId, nome, valorAtual, investido, onPronto }: { assetId: string; nome: string; valorAtual: number; investido: number | null; onPronto: () => void }) {
  const money = useMoney();
  const { showToast, showError } = useToast();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hojeISO());
  const [pendente, iniciar] = useTransition();

  const fracao = valorAtual > 0 ? Math.min(1, valor / valorAtual) : 0;
  const ficaValendo = Math.max(0, valorAtual - valor);
  const ficaInvestido = investido === null ? null : investido * (1 - fracao);

  function confirmar() {
    iniciar(async () => {
      const r = await resgatarDoAtivoAction({ assetId, amount: valor, date: data });
      if (!r.ok) return showError(r.error);
      showToast(r.meta ? `Resgate registrado. ${nome} e a meta ${r.meta} já foram atualizados.` : `Resgate registrado. ${nome} já foi atualizado.`);
      onPronto();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Hoje {nome} vale <b className="text-ink">{money(valorAtual)}</b> na carteira. Diga quanto você tirou: o resgate entra no mês e sai daqui.
      </p>
      <CurrencyField label="Quanto você resgatou" id="valorResgate" name="valorResgate" onValueChange={setValor} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Quando</span>
        <input
          type="date"
          value={data}
          max={hojeISO()}
          onChange={(e) => setData(e.target.value)}
          className="min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-ink outline-none focus:border-accent"
        />
      </label>
      {valor > 0 && (
        <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
          {valor > valorAtual + 0.01 ? (
            <p className="text-danger">É mais do que ele vale na carteira. Se rendeu mais, atualize o valor de hoje primeiro.</p>
          ) : (
            <>
              <p>
                Depois do resgate: vale <b className="text-ink">{money(ficaValendo)}</b>
                {ficaInvestido !== null && (
                  <>
                    {" "}
                    sobre <b className="text-ink">{money(ficaInvestido)}</b> investidos
                  </>
                )}
                .
              </p>
              <p className="mt-1 text-caption">A rentabilidade em % continua a mesma: o lucro que estava nesse dinheiro sai junto com ele.</p>
            </>
          )}
        </div>
      )}
      <Button type="button" disabled={pendente || valor <= 0 || valor > valorAtual + 0.01} onClick={confirmar} className="w-full sm:w-fit">
        {pendente ? "Registrando…" : "Registrar resgate"}
      </Button>
    </div>
  );
}
