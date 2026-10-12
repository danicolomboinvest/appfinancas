"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Share2 } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { Interruptor } from "@/components/ui/Interruptor";
import type { DadosDoMarco } from "../../dados";

/**
 * O fim do mapa (proposta A+B): o cartão "Organizei meu dinheiro em 21 dias", na cara do tema,
 * para compartilhar. Só diz o que é verdade nos dados dela (reserva com alvo, mês fechado, plano
 * montado). O valor achado só aparece se ela ligar "Mostrar o valor no cartão": vem desligado.
 */
export function CartaoFinal({ dados, achei }: { dados: Extract<DadosDoMarco, { n: 21 }>; achei: number }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const [comValor, setComValor] = useState(false);
  const valor = `${money(achei, { round: true })} por mês`;

  const frases: string[] = [];
  if (achei > 0) frases.push(comValor ? `Achei ${valor}` : "Achei o que escapava");
  if (dados.reserva) frases.push("Minha reserva começou");
  if (dados.fechouMes) frases.push("Fechei meu primeiro mês no app");
  if (dados.temOrcamento) frases.push("Cada real tem um destino");
  if (dados.guardar) frases.push("Guardo primeiro, gasto depois");
  if (frases.length === 0) frases.push("Sei para onde vai o meu dinheiro");
  const mostradas = frases.slice(0, 3);

  const compartilhar = () => {
    const texto = `${t.mrCartaoFrase}.\n${mostradas.join("\n")}\n#MoneyReset`;
    if (navigator.share) void navigator.share({ text: texto }).catch(() => {});
    else void navigator.clipboard?.writeText(texto);
  };

  return (
    <>
      <div
        className="mr-entra relative flex flex-col gap-3 overflow-hidden rounded-3xl border p-5"
        style={{ background: "var(--heroi-fundo, linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para)))", color: "var(--color-heroi-tinta)", borderColor: "var(--color-heroi-borda, transparent)" }}
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-heroi-suave">Money Reset · SPI Finance</span>
        <span className="titulo-tema text-[30px] font-semibold leading-[1.05] tracking-tight">{t.mrCartaoFrase}</span>
        <ul className="flex flex-col gap-2">
          {mostradas.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[15px] font-medium">
              <span className="heroi-veu flex size-5 shrink-0 items-center justify-center rounded-full">
                <Check size={11} strokeWidth={3.2} aria-hidden />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <span className="text-[12px] text-heroi-suave">21 de 21 marcos</span>
      </div>
      {achei > 0 && (
        <div className="glass overflow-hidden rounded-2xl">
          <Interruptor ligado={comValor} aoMudar={setComValor} titulo={t.mrMostrarValor} />
        </div>
      )}
      <button type="button" onClick={compartilhar} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm">
        <Share2 size={16} aria-hidden /> {t.mrCompartilhar}
      </button>
      <Link href="/money-reset" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-semibold text-ink">
        {t.mrVerMapa}
      </Link>
    </>
  );
}
