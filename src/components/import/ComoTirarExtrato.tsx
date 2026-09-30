"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { BANCOS_EXTRATO } from "./bancos-extrato";

/**
 * "Como tiro o extrato do meu banco?", embaixo do botão de subir o arquivo.
 *
 * Nada no app ensinava onde pegar o arquivo: a leiga não sabe onde fica "exportar extrato", nem
 * que o PDF chega por e-mail, e o primeiro impulso é mandar um print — que não funciona. Um
 * banco por vez (ela toca no dela), pra não virar um manual inteiro dentro da gaveta.
 */
export function ComoTirarExtrato({ abertoDeInicio = false }: { abertoDeInicio?: boolean }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [aberto, setAberto] = useState(abertoDeInicio);
  const [banco, setBanco] = useState<string | null>(null);
  const escolhido = BANCOS_EXTRATO.find((b) => b.banco === banco) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left"
      >
        <HelpCircle size={16} className="shrink-0 text-accent-strong" aria-hidden />
        <span className="flex-1 text-sm font-semibold text-ink">{t.impComoTirarTitulo}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink">{t.impComoTirarAviso}</p>
          <div className="grid grid-cols-2 gap-2">
            {BANCOS_EXTRATO.map((b) => (
              <button
                key={b.banco}
                type="button"
                onClick={() => setBanco((atual) => (atual === b.banco ? null : b.banco))}
                aria-pressed={banco === b.banco}
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  banco === b.banco ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface text-ink hover:border-accent"
                }`}
              >
                {b.banco}
              </button>
            ))}
          </div>
          {escolhido && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-ink" aria-live="polite">
              <p>
                <b>Extrato da conta:</b> {escolhido.extrato}
              </p>
              {escolhido.fatura && (
                <p>
                  <b>Fatura do cartão:</b> {escolhido.fatura}
                </p>
              )}
              {escolhido.dica && <p className="text-ink-muted">{escolhido.dica}</p>}
            </div>
          )}
          <p className="text-caption text-ink-muted">{t.impComoTirarFatura}</p>
          <p className="text-caption text-ink-muted">{t.impComoTirarOutro}</p>
        </div>
      )}
    </div>
  );
}
