"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { dispensarSugestaoAction } from "./actions";
import type { Sugestao } from "./regras";

/**
 * Bloco 1 do Resumo novo: UMA sugestão, com um número dela e um botão que faz a coisa. "Agora não"
 * some com ela até o próximo extrato e traz a próxima da fila; "Boa" fecha o "algo indo bem".
 */
export function CartaoSugestao({ sugestao, marca, maisNoDecidir }: { sugestao: Sugestao; marca: string; maisNoDecidir: number }) {
  const [saiu, setSaiu] = useState(false);
  const [pendente, comecar] = useTransition();
  const indoBem = sugestao.tipo === "indo-bem";
  const dispensar = () => {
    setSaiu(true);
    comecar(() => dispensarSugestaoAction(sugestao.tipo, sugestao.id, marca, indoBem));
  };
  if (saiu && !pendente) return null;
  return (
    <section className={`flex flex-col gap-2 transition-opacity ${saiu ? "opacity-40" : ""}`} data-sugestao={sugestao.tipo}>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${indoBem ? "bg-success-soft text-success" : "bg-accent-soft text-accent-strong"}`} aria-hidden>
            {indoBem ? <Sparkles size={18} /> : <Lightbulb size={18} />}
          </span>
          <p className="min-w-0 pt-2 text-[15px] font-medium leading-snug text-ink">{sugestao.texto}</p>
        </div>
        <div className="flex items-center gap-2">
          {sugestao.botao && (
            <Link
              href={sugestao.botao.href}
              // Tocar no botão é resolver: a sugestão não espera o "Agora não" para sair (14/10/2026).
              onClick={() => {
                if (!indoBem) comecar(() => dispensarSugestaoAction(sugestao.tipo, sugestao.id, marca, false));
              }}
              className="inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent">
              {sugestao.botao.rotulo}
            </Link>
          )}
          <button type="button" onClick={dispensar} disabled={saiu} className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-ink-muted hover:text-ink">
            {indoBem ? "Boa" : "Agora não"}
          </button>
        </div>
      </Card>
      {maisNoDecidir > 0 && (
        <Link href="/decidir" className="px-1 text-[13px] font-medium text-ink-muted underline-offset-4 hover:underline">
          Mais {maisNoDecidir} no Decidir
        </Link>
      )}
    </section>
  );
}
