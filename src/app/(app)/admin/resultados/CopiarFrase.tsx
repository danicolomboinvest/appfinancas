"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia a frase pronta pro story/post. É o uso real: ela não vai redigitar o número. */
export function CopiarFrase({ frase }: { frase: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(frase);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Navegador sem permissão de área de transferência: a frase continua na tela pra
          // selecionar à mão, então não vale mostrar erro.
        }
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:text-ink"
    >
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      {copiado ? "copiado" : "copiar"}
    </button>
  );
}
