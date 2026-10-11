"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pe, Pergunta, TopoDoAssistente } from "./pecas";
import type { DadosDasCalculadoras } from "@/lib/calculadoras/dados-do-app";

/** Os dados do app que a tela recebe do servidor (só números e nomes). */
export type DadosDaTela = DadosDasCalculadoras;

/** Uma simulação salva aberta pela lista: abre direto na tela ao vivo, já com o selo "Salva". */
export type SimulacaoAberta = { id: string; valores: Record<string, number | string> } | null;

/**
 * Uma tela do assistente: "‹ Calculadoras" (ou "‹ Voltar"), "1 de 3", a barrinha de progresso,
 * o nome da calculadora, a pergunta, o corpo e o botão grande embaixo.
 */
export function Passo({
  passo,
  total,
  nome,
  pergunta,
  onVoltar,
  pe,
  children,
}: {
  passo: number;
  total: number;
  nome: string;
  pergunta: ReactNode;
  onVoltar: () => void;
  pe: ReactNode;
  children: ReactNode;
}) {
  // Cada passo começa do topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [passo]);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-xl flex-col gap-5">
      <TopoDoAssistente voltar={passo > 1 ? "Voltar" : "Calculadoras"} onVoltar={onVoltar} passo={passo} total={total} />
      <Pergunta nome={nome}>{pergunta}</Pergunta>
      <div className="flex flex-col gap-3">{children}</div>
      <Pe>{pe}</Pe>
    </div>
  );
}

/** A tela do resultado: "‹ Calculadoras" e o resto embaixo. */
export function Fim({ voltar = "Calculadoras", onVoltar, children }: { voltar?: string; onVoltar?: () => void; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <TopoDoAssistente voltar={voltar} onVoltar={onVoltar ?? (() => router.push("/simuladores"))} />
      {children}
    </div>
  );
}

export function useIrParaCalculadoras() {
  const router = useRouter();
  return () => router.push("/simuladores");
}
