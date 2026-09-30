"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { PARADO, TEMPO_PRA_CONFIRMAR_MS, proximoEstado, type EstadoConfirmacao, type EventoConfirmacao } from "./confirmacao-dois-toques";

/**
 * Botão de apagar em DOIS toques: o 1º troca o rótulo pra "Sim, remover" e mostra um
 * "Cancelar" do lado; só o 2º apaga. Antes era um link de 12px que apagava no primeiro toque,
 * sem volta, e pequeno demais pra acertar (a regra está em confirmacao-dois-toques.ts).
 * Os dois botões têm 44px de altura de toque.
 */
export function DeleteButton({ onDelete, label }: { onDelete: () => void | Promise<void>; label?: string }) {
  const { voz } = useProfileTheme();
  const [isPending, startTransition] = useTransition();
  const [estado, setEstado] = useState<EstadoConfirmacao>(PARADO);
  const confirmando = estado.fase === "confirmando";

  function enviar(evento: EventoConfirmacao) {
    const r = proximoEstado(estado, evento);
    setEstado(r.estado);
    if (r.apagar) startTransition(() => onDelete());
  }

  // Desarma sozinho se ela não confirmar: quem esqueceu o botão armado e voltou depois não
  // pode apagar com um toque só.
  useEffect(() => {
    if (!confirmando) return;
    const timer = setTimeout(() => setEstado((e) => proximoEstado(e, { tipo: "expirou" }).estado), TEMPO_PRA_CONFIRMAR_MS);
    return () => clearTimeout(timer);
  }, [confirmando]);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => enviar({ tipo: "toque", agora: Date.now() })}
        aria-live="polite"
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-40 ${
          confirmando ? "bg-danger-soft font-semibold" : "font-medium"
        }`}
      >
        <Trash2 size={15} strokeWidth={1.75} aria-hidden />
        {confirmando ? voz.titulos.formRemoverConfirma : (label ?? voz.titulos.formRemover)}
      </button>
      {confirmando && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => enviar({ tipo: "cancelar" })}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          {voz.titulos.formCancelar}
        </button>
      )}
    </span>
  );
}
