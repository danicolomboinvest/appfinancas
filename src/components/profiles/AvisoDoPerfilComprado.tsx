"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast-context";
import { TOUR_DONE_EVENT } from "@/components/shell/InstallAppBanner";
import { CHAVE_LOCAL_NOVIDADES, abreAsNovidades, type EstadoDasNovidades } from "@/lib/novidades/passos";
import { CHAVE_LOCAL_PERFIL_COMPRADO, textosDoAvisoDoPerfilComprado, type AvisoDoPerfilComprado as Aviso } from "@/lib/perfis/perfil-comprado";
import { abrirEmpresaCompradaAction, convidarParCompradoAction, depoisDoPerfilCompradoAction } from "@/app/(app)/perfis/comprado-actions";
import { trackEvent } from "@/lib/usage/track-event";

function lerLocal(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

function gravarLocal(chave: string) {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    // Sem armazenamento: a marca da conta segura.
  }
}

/**
 * "Sua Empresa está pronta" (ou "O Casal está liberado"): uma vez, para quem comprou o adicional.
 * Mesmo desenho do "O casal ficou mais simples": o cartão preso embaixo, por cima da tela
 * escurecida. Se o "Tivemos uma mudança" ainda vai abrir, espera ele terminar.
 */
export function AvisoDoPerfilComprado({ aviso, novidades }: { aviso: Aviso; novidades: EstadoDasNovidades }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();
  const tx = textosDoAvisoDoPerfilComprado(aviso.tipo);
  const chaveLocal = `${CHAVE_LOCAL_PERFIL_COMPRADO}:${aviso.tipo}`;
  const Icone = aviso.tipo === "empresa" ? Briefcase : Heart;

  useEffect(() => {
    if (lerLocal(chaveLocal)) return;
    if (novidades !== "novo" && abreAsNovidades(novidades, false, lerLocal(CHAVE_LOCAL_NOVIDADES))) {
      const depois = () => window.setTimeout(() => setAberto(true), 500);
      window.addEventListener(TOUR_DONE_EVENT, depois, { once: true });
      return () => window.removeEventListener(TOUR_DONE_EVENT, depois);
    }
    const id = window.setTimeout(() => setAberto(true), 700);
    return () => window.clearTimeout(id);
  }, [chaveLocal, novidades]);

  const depois = useCallback(() => {
    setAberto(false);
    gravarLocal(chaveLocal);
    trackEvent(`aviso_${aviso.tipo}_comprado_depois`, "/aviso-perfil-comprado");
    void depoisDoPerfilCompradoAction(aviso.tipo).catch(() => undefined);
  }, [aviso.tipo, chaveLocal]);

  const abrir = () =>
    iniciar(async () => {
      gravarLocal(chaveLocal);
      trackEvent(`aviso_${aviso.tipo}_comprado_abrir`, "/aviso-perfil-comprado");
      const r = aviso.tipo === "empresa" ? await abrirEmpresaCompradaAction(aviso.perfilId) : await convidarParCompradoAction();
      setAberto(false);
      if (!r.ok) return showError(r.error);
      router.push(aviso.tipo === "empresa" ? "/empresa" : "/divisao");
      router.refresh();
    });

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") depois();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, depois]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-[rgba(12,8,14,0.55)] px-3 pb-[calc(0.75rem+var(--safe-bottom))] pt-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-perfil-comprado-titulo"
      data-aviso-perfil-comprado={aviso.tipo}
    >
      <div className="flex max-h-full w-full max-w-[420px] flex-col items-center overflow-y-auto rounded-[28px] bg-surface px-5 pb-4 pt-6 text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--color-border)]">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-accent-strong shadow-[inset_0_0_0_1px_var(--color-border)]" aria-hidden>
          <Icone size={24} strokeWidth={1.7} />
        </span>
        <h2 id="aviso-perfil-comprado-titulo" className="titulo-tema mt-3 text-balance text-[24px] font-medium leading-tight tracking-tight text-ink">
          {tx.titulo}
        </h2>
        <p className="mt-2 text-balance text-[15px] leading-snug text-ink-muted">{tx.texto}</p>
        <Button autoFocus className="mt-5 min-h-12 w-full text-[15px]" onClick={abrir} disabled={pendente}>
          {tx.abrir}
        </Button>
        <button type="button" onClick={depois} disabled={pendente} className="mt-1 min-h-11 px-4 text-[15px] font-medium text-ink-muted">
          {tx.depois}
        </button>
      </div>
    </div>
  );
}
