"use client";

import { useState, useTransition } from "react";
import { Home, User } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { marcarDaCasaAction } from "@/app/(app)/mensal/[year]/[month]/casa-actions";

/**
 * "Da casa" ou "Meu" no lançamento aberto (Casal simples): um toque troca. Da casa entra no
 * acerto; Meu o par vê, mas não divide. O app aprende com o comerciante.
 */
export function DaCasa({ id, daCasa }: { id: string; daCasa: boolean }) {
  const [valor, setValor] = useState(daCasa);
  const [pendente, startTransition] = useTransition();
  const { showError, showToast } = useToast();
  const opcoes = [
    { v: true, rotulo: "Da casa", icone: Home },
    { v: false, rotulo: "Meu", icone: User },
  ] as const;
  return (
    <div role="radiogroup" aria-label="De quem é este gasto" className="flex w-full rounded-full bg-surface-2 p-1" data-da-casa={valor ? "casa" : "meu"}>
      {opcoes.map((o) => {
        const on = o.v === valor;
        const Icone = o.icone;
        return (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={pendente}
            onClick={() => {
              if (on) return;
              setValor(o.v);
              startTransition(async () => {
                const r = await marcarDaCasaAction(id, o.v).catch(() => ({ ok: false }));
                if (!r.ok) {
                  setValor(!o.v);
                  showError("Não deu para mudar agora. Tente de novo.");
                } else showToast(o.v ? "Da casa: entra no acerto" : "Meu: fica fora do acerto");
              });
            }}
            className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[15px] transition-colors ${on ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}
          >
            <Icone size={17} strokeWidth={1.7} aria-hidden />
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
