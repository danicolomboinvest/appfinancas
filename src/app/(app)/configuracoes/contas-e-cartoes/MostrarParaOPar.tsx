"use client";

import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { mostrarContaParaOParAction } from "./actions";

/** "Mostrar para <par>" de uma conta (Casal simples): desligado, a conta inteira some do app do par. */
export function MostrarParaOPar({ chave, ligado, nomeDoOutro }: { chave: string; ligado: boolean; nomeDoOutro: string }) {
  const [on, setOn] = useState(ligado);
  const [pendente, startTransition] = useTransition();
  const { showError } = useToast();
  return (
    <div className="border-t border-border" data-mostrar-para-o-par={on ? "ligado" : "desligado"} data-conta={chave}>
      <Interruptor
        ligado={on}
        desabilitado={pendente}
        titulo={`Mostrar para ${nomeDoOutro}`}
        aoMudar={(v) => {
          setOn(v);
          startTransition(async () => {
            const r = await mostrarContaParaOParAction(chave, v).catch(() => ({ ok: false }));
            if (!r.ok) {
              setOn(!v);
              showError("Não deu para mudar agora. Tente de novo.");
            }
          });
        }}
      />
    </div>
  );
}
