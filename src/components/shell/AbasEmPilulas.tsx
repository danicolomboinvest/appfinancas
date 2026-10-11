"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CarrosselDeAbas, ConteudoQueDesliza } from "./Carrossel";

export type AbaEmPilula = { href: string; label: string; /** Prefixos que também acendem a aba. */ rotas?: string[] };

/**
 * Abas em carrossel, iguais às da Visão geral (AbasDaVisaoGeral), para as áreas com abas
 * próprias (a Carteira: Meus ativos, Proventos, Estratégia, Oportunidades).
 * A aba acesa é a de rota mais específica que casa ("/carteira/proventos" não acende "/carteira").
 */
export function abaAcesa(pathname: string, abas: AbaEmPilula[]): AbaEmPilula | null {
  let melhor: { aba: AbaEmPilula; tamanho: number } | null = null;
  for (const aba of abas) {
    for (const rota of aba.rotas ?? [aba.href]) {
      const casa = pathname === rota || pathname.startsWith(`${rota}/`);
      if (casa && (!melhor || rota.length > melhor.tamanho)) melhor = { aba, tamanho: rota.length };
    }
  }
  return melhor?.aba ?? null;
}

/** A faixa em carrossel (a aba aberta no centro, ver Carrossel.tsx). */
export function AbasEmPilulas({ abas, rotulo }: { abas: AbaEmPilula[]; rotulo: string }) {
  const pathname = usePathname();
  const ativa = abaAcesa(pathname, abas);
  return (
    <div className="mb-3">
      <CarrosselDeAbas rotulo={rotulo} ativa={ativa?.href ?? null} itens={abas.map((a) => ({ chave: a.href, rotulo: a.label, href: a.href }))} />
    </div>
  );
}

/** O conteúdo da área: arrastar para o lado troca de aba, como na Visão geral. */
export function ConteudoDasAbas({ abas, children }: { abas: AbaEmPilula[]; children: ReactNode }) {
  const pathname = usePathname();
  const ativa = abaAcesa(pathname, abas);
  const i = ativa ? abas.findIndex((a) => a.href === ativa.href) : -1;
  return (
    <ConteudoQueDesliza hrefs={abas.map((a) => a.href)} indice={i}>
      {children}
    </ConteudoQueDesliza>
  );
}
