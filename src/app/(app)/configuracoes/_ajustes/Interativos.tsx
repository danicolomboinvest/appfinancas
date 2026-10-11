"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Upload } from "lucide-react";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { useValoresOcultos } from "@/components/money/MoneyProvider";
import { EVENTO_IMPORTAR } from "@/components/shell/registrar-eventos";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";
import { ofertasDaAssessoriaAction } from "./conta-actions";
import { SUPORTE_EMAIL } from "./suporte";

/** "Não quero ver ofertas da assessoria" (rodada 34). */
export function DesligarOfertas({ desligadas }: { desligadas: boolean }) {
  const [v, setV] = useState(desligadas);
  const [, iniciar] = useTransition();
  const { showToast, showError } = useToast();
  const router = useRouter();
  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        <Interruptor
          ligado={v}
          titulo="Não quero ver ofertas da assessoria"
          sub="Some da Carteira, da estratégia e da Ajuda."
          aoMudar={(novo) => {
            setV(novo);
            iniciar(async () => {
              const r = await ofertasDaAssessoriaAction(novo);
              if (!r.ok) {
                setV(!novo);
                return showError("Não consegui salvar. Tente de novo.");
              }
              showToast(novo ? "Ofertas da assessoria desligadas" : "Ofertas da assessoria ligadas");
              router.refresh();
            });
          }}
        />
      </div>
      {v && (
        <p className="flex items-center gap-2 px-1 text-sm text-success">
          <Check size={15} aria-hidden /> Pronto. Nenhum cartão da assessoria vai aparecer.
        </p>
      )}
    </>
  );
}

/** Esconder valores ao abrir: o mesmo olho do topo (vale neste aparelho). */
export function EsconderValores() {
  const { ocultos, alternar } = useValoresOcultos();
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">
      <Interruptor ligado={ocultos} aoMudar={() => alternar()} titulo="Esconder valores" sub="Os valores ficam escondidos até você tocar no olho." />
    </div>
  );
}

export function CopiarEmail() {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(SUPORTE_EMAIL).catch(() => {});
        setCopiado(true);
      }}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-2 text-[15px] text-ink"
    >
      {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copiado ? "Copiado" : "Copiar o e-mail"}
    </button>
  );
}

export function ImportarExtrato() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_IMPORTAR))}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent"
    >
      <Upload size={16} aria-hidden /> Importar extrato
    </button>
  );
}

export function UsarPerfil({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await trocarPerfilAction(id);
          if (!r.ok) return showError(r.error);
          router.refresh();
        })
      }
      className="min-h-10 shrink-0 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink disabled:opacity-60"
    >
      Usar
    </button>
  );
}
