"use client";

import { useEffect } from "react";
import { House, LayoutGrid, Scale, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ParDeAvatares } from "@/components/casal-login/visual";
import { textosDoAvisoDaMigracao, type IconeDoPonto } from "@/lib/casa/aviso-migracao";
import type { CasaNaTela } from "@/lib/casa/regras";

const ICONES: Record<IconeDoPonto, typeof House> = {
  app: Smartphone,
  casa: House,
  completo: LayoutGrid,
  bolinha: Users,
  acerto: Scale,
};

/**
 * "O casal ficou mais simples": o cartão de uma vez para quem teve a casa passada do Nós dois
 * para o Casal simples. Mesmo desenho do "Tivemos uma mudança" e do "Como funciona o casal": o
 * cartão preso embaixo, por cima da tela escurecida.
 */
export function AvisoDaMigracao({ aberto, casa, aoVer, aoAgoraNao }: { aberto: boolean; casa: CasaNaTela; aoVer: () => void; aoAgoraNao: () => void }) {
  const tx = textosDoAvisoDaMigracao(casa.eu.papel);
  const titular = casa.eu.papel === "titular" ? casa.eu : casa.outro;
  const par = casa.eu.papel === "titular" ? casa.outro : casa.eu;

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoAgoraNao();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoAgoraNao]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-[rgba(12,8,14,0.55)] px-3 pb-[calc(0.75rem+var(--safe-bottom))] pt-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-migracao-titulo"
      data-aviso-casa-migrada
    >
      <div className="flex max-h-full w-full max-w-[420px] flex-col items-center overflow-y-auto rounded-[28px] bg-surface px-5 pb-4 pt-6 text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--color-border)]">
        <ParDeAvatares titular={titular.nome} par={par.nome} size={52} />
        <h2 id="aviso-migracao-titulo" className="titulo-tema mt-3 text-balance text-[24px] font-medium leading-tight tracking-tight text-ink">
          {tx.titulo}
        </h2>
        <ul className="mt-4 flex w-full flex-col gap-2.5 text-left">
          {tx.pontos.map((p) => {
            const Icone = ICONES[p.icone];
            return (
              <li key={p.icone} className="flex items-start gap-3 rounded-[18px] bg-surface-2 px-3 py-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-accent-strong shadow-[inset_0_0_0_1px_var(--color-border)]" aria-hidden>
                  <Icone size={16} strokeWidth={1.8} />
                </span>
                <span className="text-[14.5px] leading-snug text-ink">{p.texto}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[14.5px] font-medium text-ink-muted">{tx.rodape}</p>
        <Button autoFocus className="mt-3 min-h-12 w-full text-[15px]" onClick={aoVer}>
          {tx.ver}
        </Button>
        <button type="button" onClick={aoAgoraNao} className="mt-1 min-h-11 px-4 text-[15px] font-medium text-ink-muted">
          {tx.agoraNao}
        </button>
      </div>
    </div>
  );
}
