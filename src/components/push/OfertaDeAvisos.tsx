"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { ligarAvisos, podeOferecerAvisos } from "./ligar-avisos";

const DISPENSADA = "spi:oferta-avisos";

/**
 * Os avisos oferecidos na hora em que fazem sentido (07/10/2026): logo depois da importação,
 * quando já há conta e orçamento para vigiar. Só 11 pessoas ligavam os avisos, e 85 sumiram
 * depois de 2 dias sem nada que as chamasse de volta. Aparece uma vez; "Agora não" esconde.
 */
export function OfertaDeAvisos() {
  const { showToast, showError } = useToast();
  const { titulos: t } = useProfileTheme().voz;
  const [mostrar, setMostrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  useEffect(() => {
    let dispensada = false;
    try {
      dispensada = window.localStorage.getItem(DISPENSADA) === "1";
    } catch {
      // Sem localStorage (aba anônima): oferece mesmo assim.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende do navegador, só existe no cliente
    setMostrar(Boolean(chave) && !dispensada && podeOferecerAvisos());
  }, [chave]);

  if (!mostrar || !chave) return null;

  const fechar = () => {
    try {
      window.localStorage.setItem(DISPENSADA, "1");
    } catch {}
    setMostrar(false);
  };

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3 text-left">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
        <BellRing size={20} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Avisos no celular</p>
        <p className="text-caption text-ink-muted">Conta a vencer e gasto acima do orçamento</p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              try {
                const r = await ligarAvisos(chave);
                if (r === "on") showToast(t.cfgPushLigadoToast);
                fechar();
              } catch {
                showError(t.cfgPushFalhouToast);
              } finally {
                setOcupado(false);
              }
            }}
            className="rounded-full bg-pill px-4 py-1.5 text-sm font-semibold text-on-pill disabled:opacity-60"
          >
            Ligar
          </button>
          <button type="button" onClick={fechar} className="text-sm font-medium text-ink-muted hover:text-ink">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
