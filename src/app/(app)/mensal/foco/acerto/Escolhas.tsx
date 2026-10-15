"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Segmentado } from "@/components/ui/Interruptor";
import { ErroNoBotao, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { definirDivisaoAction, marcarAcertadoAction } from "./actions";

/** O jeito de dividir (pela renda ou meio a meio) e o "Marcar como acertado". Os dois mexem. */
export function Escolhas({
  divisao,
  rotuloRenda,
  rotuloCombinado,
  ano,
  mes,
  acertado,
  temValor,
}: {
  divisao: "renda" | "meio" | "combinado";
  rotuloRenda: string;
  /** "Combinado 60% e 40%" quando a casa já combinou uma parte (Configurações › Casa). */
  rotuloCombinado: string | null;
  ano: number;
  mes: number;
  acertado: boolean;
  temValor: boolean;
}) {
  const [jeito, setJeito] = useState(divisao);
  const [feito, setFeito] = useState(acertado);
  const [pendente, startTransition] = useTransition();
  // Erro no lugar (14/10/2026): embaixo do que falhou, até a próxima tentativa.
  const erroDoJeito = useErroNoBotao();
  const erroDoAcerto = useErroNoBotao();
  const opcoes = [
    { valor: "renda" as const, rotulo: rotuloRenda },
    { valor: "meio" as const, rotulo: "Meio a meio" },
    ...(rotuloCombinado ? [{ valor: "combinado" as const, rotulo: rotuloCombinado }] : []),
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
            erroDoJeito.limpar();
            const antes = jeito;
            setJeito(v);
            startTransition(async () => {
              const r = await definirDivisaoAction(v).catch(() => ({ ok: false }));
              if (!r.ok) {
                setJeito(antes);
                erroDoJeito.falhou("Não mudou. Toque de novo.");
              }
            });
          }}
        />
        <ErroNoBotao erro={erroDoJeito.erro} />
      </section>
      {(temValor || feito) && (
        <button
          type="button"
          disabled={pendente}
          data-marcar-acertado={feito ? "sim" : "nao"}
          onClick={() => {
            const novo = !feito;
            erroDoAcerto.limpar();
            setFeito(novo);
            startTransition(async () => {
              const r = await marcarAcertadoAction(ano, mes, novo).catch(() => ({ ok: false }));
              if (!r.ok) {
                setFeito(!novo);
                erroDoAcerto.falhou("Não marcou");
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
          ) : erroDoAcerto.erro ? (
            "Tentar de novo"
          ) : (
            "Marcar como acertado"
          )}
        </button>
      )}
      <ErroNoBotao erro={erroDoAcerto.erro} />
    </div>
  );
}
