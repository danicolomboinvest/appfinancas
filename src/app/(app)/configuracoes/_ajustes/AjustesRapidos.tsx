"use client";

import { useState, useTransition } from "react";
import { Explica } from "@/components/ui/Explica";
import { useToast } from "@/components/ui/toast-context";
import { setThemeAction } from "@/components/shell/theme-actions";
import { trocarMoedaAction } from "./actions";
import { currencySymbol } from "@/lib/money";

// O símbolo de cada moeda vem de money.ts, o único lugar que sabe escrever moeda.
const MOEDAS = (["BRL", "USD", "EUR", "GBP"] as const).map((valor) => ({ valor, rotulo: currencySymbol(valor) }));

/** Um seletor de pílulas: o escolhido em escuro, os outros neutros. Salva no toque. */
function Pilulas<T extends string>({ opcoes, valor, aoEscolher, desabilitado }: { opcoes: readonly { valor: T; rotulo: string }[]; valor: T; aoEscolher: (v: T) => void; desabilitado?: boolean }) {
  return (
    <div className="flex shrink-0 rounded-full bg-surface-2 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          disabled={desabilitado}
          aria-pressed={valor === o.valor}
          onClick={() => valor !== o.valor && aoEscolher(o.valor)}
          className={`min-h-9 min-w-11 rounded-full px-3 text-sm font-semibold transition-colors ${valor === o.valor ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink disabled:opacity-60"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/**
 * Modo (claro/escuro) e moeda logo no topo das Configurações, trocando num toque (07/10/2026).
 * A Dani: "a moeda, pra mim nunca fica claro onde troca; fica muito longe". Antes eram dois
 * menus dentro de "Preferências", com um botão Salvar no fim.
 */
export function AjustesRapidos({
  moeda,
  modo,
  podeEscolherModo,
  rotulos,
}: {
  moeda: string;
  modo: string;
  podeEscolherModo: boolean;
  rotulos: { modo: string; claro: string; escuro: string; moeda: string; moedaAviso: string };
}) {
  const [moedaAtual, setMoedaAtual] = useState(moeda);
  const [modoAtual, setModoAtual] = useState(modo === "light" ? "light" : "dark");
  const [pendente, iniciar] = useTransition();
  const { showToast, showError } = useToast();

  return (
    <>
      {podeEscolherModo && (
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <span className="text-[15px] font-medium text-ink">{rotulos.modo}</span>
          <Pilulas
            opcoes={[
              { valor: "light", rotulo: rotulos.claro },
              { valor: "dark", rotulo: rotulos.escuro },
            ]}
            valor={modoAtual}
            desabilitado={pendente}
            aoEscolher={(v) => {
              setModoAtual(v);
              // O tema vive no <html>: troca na hora, e o servidor guarda.
              document.documentElement.classList.toggle("light", v === "light");
              iniciar(async () => {
                const r = await setThemeAction(v);
                if (!r.ok) showError("Não consegui salvar. Tente de novo.");
              });
            }}
          />
        </div>
      )}
      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          {rotulos.moeda}
          <Explica>{rotulos.moedaAviso}</Explica>
        </span>
        <Pilulas
          opcoes={MOEDAS}
          valor={moedaAtual as (typeof MOEDAS)[number]["valor"]}
          desabilitado={pendente}
          aoEscolher={(v) => {
            const antes = moedaAtual;
            setMoedaAtual(v);
            iniciar(async () => {
              const r = await trocarMoedaAction(v);
              if (!r.ok) {
                setMoedaAtual(antes);
                return showError(r.error ?? "Não consegui salvar. Tente de novo.");
              }
              showToast("Moeda trocada. Os valores não mudam, só o símbolo.");
            });
          }}
        />
      </div>
    </>
  );
}
