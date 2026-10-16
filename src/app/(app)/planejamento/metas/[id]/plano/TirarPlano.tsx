"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { tirarPlanoAction } from "./acoes";

/** "Tirar o plano": o primeiro toque pergunta, o segundo tira. A meta fica como está. */
export function TirarPlano({ metaId }: { metaId: string }) {
  const router = useRouter();
  const erro = useErroNoBotao();
  const [pendente, iniciar] = useTransition();
  const [certeza, setCerteza] = useState(false);
  function tirar() {
    if (!certeza) return setCerteza(true);
    erro.limpar();
    iniciar(async () => {
      const r = await tirarPlanoAction(metaId);
      if (!r.ok) return erro.falhou(r.error);
      router.push(`/planejamento/metas/${metaId}`);
      router.refresh();
    });
  }
  return (
    <>
      <button type="button" onClick={tirar} disabled={pendente} className={`flex min-h-[48px] w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold ${certeza ? "bg-danger-soft text-danger" : "text-ink-muted"} ${erro.classe}`}>
        {pendente ? "Tirando…" : erro.erro ? TENTAR_DE_NOVO : certeza ? "Toque de novo para tirar o plano" : "Tirar o plano"}
      </button>
      <ErroNoBotao erro={erro.erro} />
    </>
  );
}
