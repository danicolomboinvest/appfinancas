"use client";

import { useState, useTransition } from "react";
import { Explica } from "@/components/ui/Explica";
import { useToast } from "@/components/ui/toast-context";
import { setThemeAction } from "@/components/shell/theme-actions";
import { aplicarModo } from "@/components/shell/ThemeSync";
import { trocarMoedaAction } from "./actions";
import { currencySymbol, CURRENCY_CODES } from "@/lib/money";

// O símbolo de cada moeda vem de money.ts, o único lugar que sabe escrever moeda.
const MOEDAS = CURRENCY_CODES.map((valor) => ({ valor, rotulo: currencySymbol(valor) }));

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
          className={`min-h-9 min-w-11 whitespace-nowrap rounded-full px-2.5 text-sm font-medium transition-colors ${valor === o.valor ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink disabled:opacity-60"}`}
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
  so,
}: {
  /** Só um dos dois (versão nova: Aparência tem o modo; Moeda e dólar, a moeda). */
  so?: "modo" | "moeda";
  moeda: string;
  modo: string;
  podeEscolherModo: boolean;
  rotulos: { modo: string; claro: string; escuro: string; moeda: string; moedaAviso: string };
}) {
  const [moedaAtual, setMoedaAtual] = useState(moeda);
  const [modoAtual, setModoAtual] = useState<"light" | "dark" | "auto">(modo === "dark" || modo === "auto" ? modo : "light");
  const [pendente, iniciar] = useTransition();
  const { showError } = useToast();

  return (
    <>
      {podeEscolherModo && so !== "moeda" && (
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <span className="text-[15px] font-medium text-ink">{rotulos.modo}</span>
          <Pilulas
            opcoes={[
              { valor: "light", rotulo: rotulos.claro },
              { valor: "dark", rotulo: rotulos.escuro },
              // Automático: segue o modo do celular (claro de dia, escuro à noite, se ele estiver assim).
              { valor: "auto", rotulo: "Automático" },
            ]}
            valor={modoAtual}
            desabilitado={pendente}
            aoEscolher={(v) => {
              setModoAtual(v);
              // O tema vive no <html>: troca na hora, e o servidor guarda.
              const escuro = v === "dark" || (v === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
              aplicarModo(escuro ? "dark" : "light");
              try {
                localStorage.setItem("theme", v);
              } catch {
                // Modo privado: vale para esta sessão.
              }
              iniciar(async () => {
                const r = await setThemeAction(v);
                if (!r.ok) showError("Não salvou. Tente de novo.");
              });
            }}
          />
        </div>
      )}
      {so !== "modo" && (
      <div className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2 ${so === "moeda" ? "" : "border-t border-border"}`}>
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
                return showError(r.error ?? "Não salvou. Tente de novo.");
              }
              // Sem aviso: os valores já trocam de símbolo na tela.
            });
          }}
        />
      </div>
      )}
    </>
  );
}
