"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { textosDoAvisoDoCasalNoPessoal } from "@/lib/casa/aviso-casal-no-pessoal";
import { marcarAvisoDoCasalNoPessoalVistoAction } from "@/app/(app)/configuracoes/casa/actions";
import { trackEvent } from "@/lib/usage/track-event";

/**
 * O cartão de uma vez no Resumo da titular depois que o par aceitou (lib/casa/aviso-casal-no-pessoal):
 * mesmo desenho do cartão de sugestão (ícone, uma frase, um botão), nunca um modal. "Entendi" some
 * com ele para sempre; "Ver a casa" também marca como visto e abre Configurações › Casa.
 */
export function AvisoDoCasalNoPessoal({ nomeDoPar }: { nomeDoPar: string }) {
  const [saiu, setSaiu] = useState(false);
  const [pendente, comecar] = useTransition();
  const tx = textosDoAvisoDoCasalNoPessoal(nomeDoPar);
  const marcar = (como: "entendi" | "ver") => {
    setSaiu(true);
    trackEvent(como === "ver" ? "aviso_casal_no_pessoal_ver" : "aviso_casal_no_pessoal_entendi", "/aviso-casal-no-pessoal");
    comecar(() => marcarAvisoDoCasalNoPessoalVistoAction().then(() => undefined));
  };
  if (saiu && !pendente) return null;
  return (
    <section className={`transition-opacity ${saiu ? "opacity-40" : ""}`} data-aviso-casal-no-pessoal>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
            <Users size={18} />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-[15px] font-medium leading-snug text-ink">{tx.titulo}</p>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-muted">{tx.texto}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => marcar("entendi")} disabled={saiu} className="inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent">
            {tx.entendi}
          </button>
          <Link href="/configuracoes/casa" onClick={() => marcar("ver")} className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-ink-muted hover:text-ink">
            {tx.verACasa}
          </Link>
        </div>
      </Card>
    </section>
  );
}
