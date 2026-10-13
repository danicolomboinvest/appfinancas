"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { VIDEOS_COMO_FUNCIONA } from "@/lib/novidades/passos";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { AtalhoDoCasal } from "@/components/casa/AtalhoDoCasal";

/** O menu pede a folha por este evento (o item "Como funciona" não sai da tela em que ela está). */
export const ABRIR_COMO_FUNCIONA = "spi:como-funciona";

/**
 * "Como funciona" (protótipo: menu › Como funciona): uma folha por cima da tela com os 5 vídeos
 * curtos, um embaixo do outro, cada um com título e resumo. O manual por escrito continua em /guia,
 * num link pequeno no fim.
 */
export function ComoFuncionaSheet() {
  const [aberto, setAberto] = useState(false);
  const { casa } = useProfileTheme();
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(ABRIR_COMO_FUNCIONA, abrir);
    return () => window.removeEventListener(ABRIR_COMO_FUNCIONA, abrir);
  }, []);
  return (
    <Modal open={aberto} onClose={() => setAberto(false)} title="Como funciona">
      <div className="flex flex-col gap-5" data-como-funciona>
        {/* Casal simples: o tutorial do casal antes dos vídeos. */}
        {casa && <AtalhoDoCasal casa={casa} antes={() => setAberto(false)} />}
        <p className="-mt-2 text-sm text-ink-muted">Cinco vídeos curtos, gravados no próprio app, com narração.</p>
        {VIDEOS_COMO_FUNCIONA.map((v) => (
          <div key={v.arquivo} className="flex flex-col gap-2">
            <video src={v.src} poster={v.poster} controls playsInline preload="none" className="aspect-[9/16] max-h-[60dvh] w-full rounded-2xl bg-surface-2 object-contain" />
            <b className="text-[15px] font-medium text-ink">{v.titulo}</b>
            <span className="-mt-1.5 text-sm text-ink-muted">{v.sub}</span>
          </div>
        ))}
        <Link href="/guia" onClick={() => setAberto(false)} className="mx-auto min-h-11 text-sm text-ink-muted underline underline-offset-4">
          Prefere ler? O manual completo
        </Link>
      </div>
    </Modal>
  );
}

/** Abre a folha (para os links "Como funciona" do menu e do fim do tour). */
export function abrirComoFunciona(e?: { preventDefault: () => void }) {
  e?.preventDefault();
  window.dispatchEvent(new Event(ABRIR_COMO_FUNCIONA));
}
