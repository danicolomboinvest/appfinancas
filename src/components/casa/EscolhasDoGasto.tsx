"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PerguntasDoCasal } from "@/components/casa/PerguntasDoCasal";
import type { CasalDaLinha } from "@/components/casa/SelosDoCasal";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { escolhasDoCasalAction } from "@/app/(app)/mensal/[year]/[month]/casa-actions";
import type { CasaNaTela } from "@/lib/casa/regras";
import { escolhasDoLancamento, escolhasNoFormulario, type DivisaoDaCasa, type Escolhas } from "@/lib/casa/escolhas";

/**
 * As três escolhas num gasto MEU já salvo (Casal simples, versão A de 15/10/2026): abrir o
 * lançamento deixa trocar de quem é, quem pagou e como divide. O Salvar aparece quando algo mudou.
 */
export function EscolhasDoGasto({
  id,
  casa,
  casal,
  daCasa,
  divisao,
  valor,
  money,
}: {
  id: string;
  casa: CasaNaTela;
  casal: CasalDaLinha;
  daCasa: boolean;
  divisao: DivisaoDaCasa;
  valor: number;
  money: (v: number) => string;
}) {
  const router = useRouter();
  const [salvas, setSalvas] = useState<Escolhas>(() => escolhasDoLancamento(casal, daCasa, divisao));
  const [escolhas, setEscolhas] = useState<Escolhas>(salvas);
  const [pendente, startTransition] = useTransition();
  const erro = useErroNoBotao();
  const campos = escolhasNoFormulario(escolhas, divisao.modo);
  const mudou = JSON.stringify(campos) !== JSON.stringify(escolhasNoFormulario(salvas, divisao.modo));
  return (
    <div className="flex flex-col gap-3" data-escolhas-do-gasto>
      <PerguntasDoCasal casa={casa} escolhas={escolhas} aoMudar={setEscolhas} divisao={divisao} valor={valor} money={money} />
      {mudou && (
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            erro.limpar();
            startTransition(async () => {
              const r = await escolhasDoCasalAction(id, { casaDeQuem: campos.casaDeQuem, casaPagou: campos.casaPagou, casaDivisao: campos.casaDivisao, casaParte: campos.casaParte }).catch(() => ({ ok: false }));
              if (!r.ok) {
                erro.falhou("Não salvou. Toque de novo.");
                return;
              }
              setSalvas(escolhas);
              router.refresh();
            });
          }}
          className="min-h-12 w-full rounded-full bg-ink text-[16px] font-medium text-canvas disabled:opacity-50"
        >
          {pendente ? "Salvando" : erro.erro ? TENTAR_DE_NOVO : "Salvar"}
        </button>
      )}
      <ErroNoBotao erro={erro.erro} />
    </div>
  );
}
