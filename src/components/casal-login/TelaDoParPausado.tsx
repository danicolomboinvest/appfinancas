"use client";

import { useTransition } from "react";
import { Download, PauseCircle } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { logoutAction } from "@/lib/auth/actions";
import { BOTAO_CLARO, BOTAO_ESCURO } from "./visual";

/**
 * O que o par vê quando o Casal da titular parou de valer (ela não renovou). O acesso para na
 * hora; o histórico fica guardado 90 dias e volta inteiro se ela renovar. Nesse tempo ele ainda
 * baixa a cópia do que lançou.
 */
export function TelaDoParPausado({ nomeTitular, ate, simples = false, saiu = null }: { nomeTitular: string; ate: Date | null; simples?: boolean; saiu?: "saiu" | "tirado" | null }) {
  const [saindo, sair] = useTransition();
  const ateTxt = ate ? ate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }) : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-[400px] text-center">
        <BrandMark size={44} className="mx-auto" />
        <span className="mx-auto mt-8 flex size-16 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <PauseCircle size={28} strokeWidth={1.5} />
        </span>
        <h1 className="titulo-tema mt-6 text-[32px] font-medium leading-tight text-ink">{saiu ? "Você não está mais na casa" : simples ? "O Casal está pausado" : "O Nós dois está pausado"}</h1>
        <p className="mt-3 text-balance text-[17px] leading-relaxed text-ink-muted">
          {saiu
            ? `${saiu === "saiu" ? "Você saiu da casa" : "A casa terminou"} com ${nomeTitular}. Seus lançamentos ficam guardados${ateTxt ? ` até ${ateTxt}` : " por 90 dias"}. Com o SPI próprio, tudo continua.`
            : `O Casal de ${nomeTitular} não foi renovado. Tudo fica guardado${ateTxt ? ` até ${ateTxt}` : " por 90 dias"} e volta como estava com a renovação.`}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {/* No Casal simples o que ele lançou está no Pessoal dele, que fica fechado nesta pausa: a
              cópia sai do mesmo link (o termo promete "Se eu sair, levo uma cópia do que lancei"). */}
          {ateTxt && (
            <a href="/api/casal/lancamentos" className={BOTAO_ESCURO}>
              <Download size={20} strokeWidth={1.7} aria-hidden />
              Baixar o que eu lancei
            </a>
          )}
          <button type="button" disabled={saindo} onClick={() => sair(() => logoutAction())} className={BOTAO_CLARO}>
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
