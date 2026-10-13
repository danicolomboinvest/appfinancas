"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Segmentado } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { definirDivisaoAction, marcarAcertadoAction } from "./actions";

/** O jeito de dividir (pela renda ou meio a meio) e o "Marcar como acertado". Os dois mexem. */
export function Escolhas({ divisao, rotuloRenda, ano, mes, acertado, temValor }: { divisao: "renda" | "meio" | "combinado"; rotuloRenda: string; ano: number; mes: number; acertado: boolean; temValor: boolean }) {
  const [jeito, setJeito] = useState(divisao);
  const [feito, setFeito] = useState(acertado);
  const [pendente, startTransition] = useTransition();
  const { showError } = useToast();
  const opcoes = [
    { valor: "renda" as const, rotulo: rotuloRenda },
    { valor: "meio" as const, rotulo: "Meio a meio" },
    ...(divisao === "combinado" ? [{ valor: "combinado" as const, rotulo: "Combinado" }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[15px] font-medium text-ink">Como dividir</h2>
        <Segmentado
          rotulo="Como dividir"
          opcoes={opcoes}
          valor={jeito}
          aoEscolher={(v) => {
            if (v === "combinado") return;
            const antes = jeito;
            setJeito(v);
            startTransition(async () => {
              const r = await definirDivisaoAction(v).catch(() => ({ ok: false }));
              if (!r.ok) {
                setJeito(antes);
                showError("Não deu para mudar agora. Tente de novo.");
              }
            });
          }}
        />
      </section>
      {(temValor || feito) && (
        <button
          type="button"
          disabled={pendente}
          data-marcar-acertado={feito ? "sim" : "nao"}
          onClick={() => {
            const novo = !feito;
            setFeito(novo);
            startTransition(async () => {
              const r = await marcarAcertadoAction(ano, mes, novo).catch(() => ({ ok: false }));
              if (!r.ok) {
                setFeito(!novo);
                showError("Não deu para marcar agora. Tente de novo.");
              }
            });
          }}
          className={
            feito
              ? "flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-success-soft px-5 text-[16px] font-medium text-success"
              : "flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-5 text-[16px] font-medium text-canvas disabled:opacity-60"
          }
        >
          {feito ? (
            <>
              <Check size={18} strokeWidth={2} aria-hidden /> Acertado
            </>
          ) : (
            "Marcar como acertado"
          )}
        </button>
      )}
    </div>
  );
}
