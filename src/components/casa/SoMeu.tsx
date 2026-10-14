"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Interruptor } from "@/components/ui/Interruptor";
import { ErroNoBotao, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { marcarSoMeuAction } from "@/app/(app)/mensal/[year]/[month]/casa-actions";

/** "Só meu" no lançamento aberto: um toque, e some do app do par e dos totais dele. */
export function SoMeu({ id, ligado, nomeDoOutro }: { id: string; ligado: boolean; nomeDoOutro: string }) {
  const [on, setOn] = useState(ligado);
  const [pendente, startTransition] = useTransition();
  const erro = useErroNoBotao();
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-2" data-so-meu={on ? "ligado" : "desligado"}>
      <Interruptor
        ligado={on}
        desabilitado={pendente}
        icone={
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink" aria-hidden>
            <Lock size={18} strokeWidth={1.6} />
          </span>
        }
        titulo="Só meu"
        sub={on ? `${nomeDoOutro} não vê este gasto` : `${nomeDoOutro} também vê`}
        aoMudar={(v) => {
          erro.limpar();
          setOn(v);
          startTransition(async () => {
            const r = await marcarSoMeuAction(id, v).catch(() => ({ ok: false }));
            if (!r.ok) {
              setOn(!v);
              erro.falhou("Não mudou. Toque de novo.");
            }
          });
        }}
      />
      <ErroNoBotao erro={erro.erro} className={erro.erro ? "pb-2" : ""} />
    </div>
  );
}
