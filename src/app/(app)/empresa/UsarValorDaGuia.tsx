"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { ErroNoBotao } from "@/components/ui/ErroNoBotao";
import type { ValorDaGuia } from "@/lib/empresa/legal";
import { usarValorDaGuiaAction } from "./actions";
import { BOTAO_PRINCIPAL } from "./partes";

/**
 * "Usar o valor da minha guia" (15/10/2026): ela digita o valor da guia que recebeu e ele passa a
 * valer em todo lugar (Resumo, Impostos, a conta "Guia do MEI"). A tela responde no lugar: o valor
 * de cima muda, sem aviso solto. Com o valor dela valendo, dá para voltar para o estimado.
 */
export function UsarValorDaGuia({ origem }: { origem: ValorDaGuia["origem"] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar(v: number | null) {
    setErro(null);
    iniciar(async () => {
      const r = await usarValorDaGuiaAction(v);
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
      setValor(null);
      router.refresh();
    });
  }

  const link = "inline-flex min-h-11 items-center self-start px-1 text-[15px] font-medium text-accent-strong underline-offset-4 hover:underline disabled:opacity-50";

  if (!aberto) {
    return (
      <div className="flex flex-wrap gap-x-4">
        <button type="button" onClick={() => setAberto(true)} className={link} data-usar-valor-da-guia>
          Usar o valor da minha guia
        </button>
        {origem === "digitada" && (
          <button type="button" onClick={() => salvar(null)} disabled={salvando} className={link}>
            Voltar para o estimado
          </button>
        )}
        <ErroNoBotao erro={erro} lado="esquerda" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-1">
      <label className="flex items-center justify-between gap-3">
        <b className="text-[15px] font-medium text-ink">Valor da sua guia</b>
        <span className="flex items-center rounded-2xl bg-surface-2 px-3 py-2">
          <CampoDeDinheiro
            valor={valor}
            onValor={setValor}
            currency="BRL"
            comSimbolo
            max={100_000}
            autoFocus
            placeholder="R$ 0,00"
            aria-label="Valor da sua guia do MEI, em reais"
            className="w-32 bg-transparent text-right text-[17px] font-medium tabular-nums text-ink outline-none"
          />
        </span>
      </label>
      <button type="button" disabled={!valor || salvando} onClick={() => salvar(valor)} className={BOTAO_PRINCIPAL}>
        Usar este valor
      </button>
      <button type="button" onClick={() => { setAberto(false); setErro(null); }} className="min-h-11 text-[15px] text-ink-muted">
        Cancelar
      </button>
      <ErroNoBotao erro={erro} lado="esquerda" />
    </div>
  );
}
