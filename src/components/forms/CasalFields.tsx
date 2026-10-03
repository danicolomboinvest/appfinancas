"use client";

import { useState } from "react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

const ULTIMA_PESSOA_KEY = "casal-ultima-pessoa";

function ultimaPessoa(): "A" | "B" {
  try {
    return window.localStorage.getItem(ULTIMA_PESSOA_KEY) === "B" ? "B" : "A";
  } catch {
    return "A";
  }
}

/**
 * Perfil Casal (out/2026): quem pagou (ou recebeu) e se o gasto é da casa ou pessoal. É o que
 * alimenta o "Acerto do mês". Fora do Casal não aparece e o formulário nem manda os campos.
 * Num lançamento novo, a pessoa começa na última usada neste aparelho (cada um costuma lançar
 * do próprio celular).
 */
export function CasalFields({
  tipo,
  defaultPessoa,
  defaultDoCasal,
}: {
  /** EXPENSE, INCOME ou INVESTMENT_CONTRIBUTION: muda a pergunta e esconde "da casa" fora de gasto. */
  tipo: string;
  defaultPessoa?: string | null;
  defaultDoCasal?: boolean | null;
}) {
  const { nomesDoCasal } = useProfileTheme();
  const [pessoa, setPessoa] = useState<"A" | "B">(() =>
    defaultPessoa === "A" || defaultPessoa === "B" ? defaultPessoa : typeof window === "undefined" ? "A" : ultimaPessoa(),
  );
  const [doCasal, setDoCasal] = useState(defaultDoCasal !== false);
  if (!nomesDoCasal) return null;

  const pergunta = tipo === "INCOME" ? "Quem recebeu?" : tipo === "EXPENSE" ? "Quem pagou?" : "De quem é?";
  function escolher(p: "A" | "B") {
    setPessoa(p);
    try {
      window.localStorage.setItem(ULTIMA_PESSOA_KEY, p);
    } catch {}
  }

  const opcao = (ativo: boolean) =>
    `flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
      ativo ? "bg-ink text-canvas" : "text-ink hover:bg-surface"
    }`;

  return (
    <div className="flex w-full flex-col gap-3">
      <input type="hidden" name="pessoa" value={pessoa} />
      <input type="hidden" name="tipoCasal" value={tipo === "EXPENSE" ? (doCasal ? "casa" : "pessoal") : ""} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-muted">{pergunta}</span>
        <div role="group" aria-label={pergunta} className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
          {(["A", "B"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={pessoa === p} onClick={() => escolher(p)} className={opcao(pessoa === p)}>
              <span
                aria-hidden
                className={`flex size-6 items-center justify-center rounded-full text-xs font-bold text-white ${p === "A" ? "bg-accent-strong" : "bg-[#3F6E8C]"}`}
              >
                {nomesDoCasal[p].charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{nomesDoCasal[p]}</span>
            </button>
          ))}
        </div>
      </div>
      {tipo === "EXPENSE" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-muted">Esse gasto é</span>
          <div role="group" aria-label="Esse gasto é" className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
            <button type="button" aria-pressed={doCasal} onClick={() => setDoCasal(true)} className={opcao(doCasal)}>
              Da casa
            </button>
            <button type="button" aria-pressed={!doCasal} onClick={() => setDoCasal(false)} className={opcao(!doCasal)}>
              Pessoal
            </button>
          </div>
          <p className="text-xs text-ink-faint">
            {doCasal ? "Entra no acerto do mês entre vocês dois." : `Fica só na conta de ${nomesDoCasal[pessoa]}, fora do acerto.`}
          </p>
        </div>
      )}
    </div>
  );
}
