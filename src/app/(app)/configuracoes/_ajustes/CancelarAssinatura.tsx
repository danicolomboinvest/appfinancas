"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

/**
 * "Cancelar assinatura" (decisão da Dani, 11/10): um link pequeno no fim das Configurações que só
 * explica o caminho. Nada cancela daqui, sem destaque e sem cor de alerta.
 */
export function CancelarAssinatura({ via }: { via: "apple" | "site" | null }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="mx-auto min-h-11 px-3 text-[13px] text-ink-faint underline-offset-2 hover:underline">
        Cancelar assinatura
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title="Cancelar assinatura">
        <div className="flex flex-col gap-4 text-sm text-ink">
          {via !== "apple" && (
            <div className="flex flex-col gap-1">
              <b className="font-medium">Comprou pelo site</b>
              <p className="text-ink-muted">O cancelamento é pela Hubla, onde foi feita a compra: entre na sua conta da Hubla com o e-mail da compra e abra a assinatura do SPI Finance.</p>
            </div>
          )}
          {via !== "site" && (
            <div className="flex flex-col gap-1">
              <b className="font-medium">Comprou pelo iPhone</b>
              <p className="text-ink-muted">Em Ajustes do iPhone, toque no seu nome e depois em Assinaturas.</p>
            </div>
          )}
          <p className="text-ink-muted">Você continua com tudo até o fim do período pago.</p>
          <button type="button" onClick={() => setAberto(false)} className="min-h-12 rounded-full bg-surface-2 text-[15px] text-ink">
            Entendi
          </button>
        </div>
      </Modal>
    </>
  );
}
